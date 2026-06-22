import type { QueryableDatabase } from '../databaseAdapter.js';
import { predictionRepository } from '../../domain/predictionRepository.js';
import { db } from '../db.js';
import { getResultsAgentStatus, runResultsAgentCycle } from './resultAgentRuntime.js';
import { migrateResultPersistenceSchema } from './resultPersistenceSchema.js';
import { backfillTopScorersFromConfirmedResults, rebuildTopScorerStandings } from './topScorerStandings.js';
import { normalizeScorerName } from './scorerNormalization.js';
import { CONFIRMED_FINAL_RESULT_SQL, isConfirmedFinalResult } from './finalizedResultState.js';
import type { ResultAgentStatus } from './resultTypes.js';
import {
  markPublicDashboardStateRebuilt,
  rebuildGroupStandingsCacheFromConfirmedResults,
  rebuildLeaderboardCacheFromConfirmedResults,
  rebuildPublicTournamentState
} from './publicTournamentRebuild.js';
import { classifyPublicMatchState } from './publicMatchState.js';

const METADATA_ID = 'public-state';
const REPAIR_ACTIONS = new Set(['catch-up', 'rebuild-public-dashboard', 'rebuild-group-standings', 'rebuild-leaderboard', 'rebuild-top-scorers', 'resync-scorers-from-confirmed-results']);

let repairInFlight: Promise<PublicStateRepairResult | undefined> | undefined;

export type PublicStateRepairAction =
  | 'catch-up'
  | 'rebuild-public-dashboard'
  | 'rebuild-group-standings'
  | 'rebuild-leaderboard'
  | 'rebuild-top-scorers'
  | 'resync-scorers-from-confirmed-results';

export interface PublicStateDiagnostics {
  generatedAt: string;
  serverTime: string;
  resultAgentStatus: ResultAgentStatus;
  confirmedResultsCount: number;
  confirmedGoalsCount: number;
  liveMatchesCount: number;
  latestResultsCount: number;
  groupStandingsSource: 'computed-from-confirmed-results';
  groupStandingsRowsCount: number;
  topScorerRowsCount: number;
  leaderboardRowsCount: number;
  canonicalLeaderboardRowsCount: number;
  scorerFactsCount: number;
  scorerFactsGoalsCount: number;
  topScorerCacheRowsCount: number;
  leaderboardCacheRowsCount: number;
  topScorerGoalsCount: number;
  topScorerNameAnomaliesCount: number;
  lastResultSyncAt?: string;
  lastPublicDashboardReadAt?: string;
  lastPublicSnapshotRebuildAt?: string;
  lastScorerRebuildAt?: string;
  lastProviderCheckAt?: string;
  lastLeaderboardRebuildAt?: string;
  providerScorerDataDetected: 'yes' | 'no' | 'unknown';
  lastRepairAction?: PublicStateRepairAction;
  lastRepairActionAt?: string;
  lastRepairActionStatus?: 'ok' | 'failed';
  lastRepairActionError?: string;
  staleState: boolean;
  staleReasons: string[];
  operatorStatus: 'OK' | 'Needs sync' | 'Running' | 'Failed';
}

export interface PublicStateRepairResult {
  action: PublicStateRepairAction;
  status: 'ok' | 'failed';
  message: string;
  generatedAt: string;
  publicSnapshotRebuiltAt: string;
  resultAgentRun?: Awaited<ReturnType<typeof runResultsAgentCycle>>;
  leaderboardRowsCount: number;
  topScorerRowsCount: number;
  groupStandingsRowsCount: number;
}

export type FullSafeRebuildStepKey =
  | 'result-agent-catch-up'
  | 'resync-scorers-from-confirmed-results'
  | 'rebuild-group-standings'
  | 'rebuild-leaderboard'
  | 'rebuild-top-scorers'
  | 'rebuild-public-dashboard';

export interface FullSafeRebuildSummary {
  scoresUpdated: number;
  scorerFactsInserted: number;
  scorerFactsUpdated: number;
  scorerFactsSkipped: number;
  groupStandingsRebuilt: boolean;
  groupStandingsRowsCount: number;
  leaderboardRebuilt: boolean;
  leaderboardRowsCount: number;
  topScorerStandingsRebuilt: boolean;
  topScorerRowsCount: number;
  publicDashboardRebuilt: boolean;
  publicDashboardRebuiltAt?: string;
}

export interface FullSafeRebuildStepResult {
  step: FullSafeRebuildStepKey;
  label: string;
  status: 'ok' | 'failed';
  message: string;
  details?: Record<string, unknown>;
}

export interface FullSafeRebuildResult {
  status: 'ok' | 'failed';
  message: string;
  generatedAt: string;
  stepsCompleted: string[];
  failedStep?: FullSafeRebuildStepResult;
  steps: FullSafeRebuildStepResult[];
  summary: FullSafeRebuildSummary;
}

export interface FullSafeRebuildStepDefinition {
  step: FullSafeRebuildStepKey;
  label: string;
  run(): Promise<{
    message: string;
    summary?: Partial<FullSafeRebuildSummary>;
    details?: Record<string, unknown>;
  }>;
}

interface PublicStateMetadataRow {
  id: string;
  last_public_dashboard_read_at?: string;
  last_public_snapshot_rebuild_at?: string;
  last_repair_action?: string;
  last_repair_action_at?: string;
  last_repair_action_status?: string;
  last_repair_action_error?: string;
}

export async function collectPublicStateDiagnostics(input: {
  db?: QueryableDatabase;
  now?: Date;
  resultAgentStatus?: ResultAgentStatus;
} = {}): Promise<PublicStateDiagnostics> {
  const database = input.db ?? db;
  const now = input.now ?? new Date();
  await migrateResultPersistenceSchema(database);
  const resultAgentStatus = input.resultAgentStatus ?? await getResultsAgentStatus(now);
  const metadata = await readPublicStateMetadata(database);
  const confirmedResultsCount = await countConfirmedResults(database);
  const confirmedGoalsCount = await countConfirmedGoals(database);
  const liveMatchesCount = await countLiveMatches(database, now);
  const latestResultsCount = Math.min(confirmedResultsCount, 8);
  const groupStandingsRowsCount = await countRows(database, 'group_standings');
  const leaderboardCacheRowsCount = await countRows(database, 'leaderboard_entries');
  const topScorerCacheRowsCount = await countRows(database, 'top_scorer_standings');
  const scorerFactsCount = await countRows(database, 'result_manual_scorers');
  const scorerFactsGoalsCount = await countScorerFactGoals(database);
  const topScorerGoalsCount = await countTopScorerGoals(database);
  const topScorerNameAnomaliesCount = await countTopScorerNameAnomalies(database);
  const topScorerRowsCount = topScorerCacheRowsCount;
  const canonicalLeaderboardRowsCount = predictionRepository.getPlayers().length;
  const leaderboardRowsCount = leaderboardCacheRowsCount;
  const lastResultSyncAt = await readLastResultSyncAt(database);
  const lastScorerRebuildAt = await readLastScorerRebuildAt(database);
  const providerScorerDataDetected = await detectProviderScorerData(database);
  const staleReasons = buildStaleReasons({
    confirmedResultsCount,
    confirmedGoalsCount,
    latestResultsCount,
    groupStandingsRowsCount,
    leaderboardCacheRowsCount,
    canonicalLeaderboardRowsCount,
    scorerFactsCount,
    scorerFactsGoalsCount,
    topScorerRowsCount,
    topScorerCacheRowsCount,
    topScorerGoalsCount,
    topScorerNameAnomaliesCount,
    providerScorerDataDetected
  });
  const operatorStatus = deriveOperatorStatus(resultAgentStatus, staleReasons, metadata);

  return {
    generatedAt: now.toISOString(),
    serverTime: now.toISOString(),
    resultAgentStatus,
    confirmedResultsCount,
    confirmedGoalsCount,
    liveMatchesCount,
    latestResultsCount,
    groupStandingsSource: 'computed-from-confirmed-results',
    groupStandingsRowsCount,
    topScorerRowsCount,
    leaderboardRowsCount,
    canonicalLeaderboardRowsCount,
    scorerFactsCount,
    scorerFactsGoalsCount,
    topScorerCacheRowsCount,
    leaderboardCacheRowsCount,
    topScorerGoalsCount,
    topScorerNameAnomaliesCount,
    lastResultSyncAt,
    lastPublicDashboardReadAt: metadata.last_public_dashboard_read_at,
    lastPublicSnapshotRebuildAt: metadata.last_public_snapshot_rebuild_at,
    lastScorerRebuildAt,
    lastProviderCheckAt: resultAgentStatus.lastRunAt ?? undefined,
    lastLeaderboardRebuildAt: resultAgentStatus.lastLeaderboardRebuildAt ?? undefined,
    providerScorerDataDetected,
    lastRepairAction: normalizeRepairAction(metadata.last_repair_action),
    lastRepairActionAt: metadata.last_repair_action_at,
    lastRepairActionStatus: normalizeRepairStatus(metadata.last_repair_action_status),
    lastRepairActionError: metadata.last_repair_action_error,
    staleState: staleReasons.length > 0,
    staleReasons,
    operatorStatus
  };
}

export async function touchPublicDashboardRead(input: { db?: QueryableDatabase; now?: Date } = {}): Promise<void> {
  const database = input.db ?? db;
  const now = input.now ?? new Date();
  await migrateResultPersistenceSchema(database);
  await writePublicStateMetadata(database, {
    last_public_dashboard_read_at: now.toISOString()
  });
}

export async function runPublicStateRepairAction(input: {
  action: PublicStateRepairAction;
  db?: QueryableDatabase;
  now?: Date;
  reason?: string;
}): Promise<PublicStateRepairResult> {
  const database = input.db ?? db;
  const now = input.now ?? new Date();
  await migrateResultPersistenceSchema(database);
  if (!REPAIR_ACTIONS.has(input.action)) {
    throw new Error(`Unsupported public state repair action "${input.action}".`);
  }

  await writePublicStateMetadata(database, {
    last_repair_action: input.action,
    last_repair_action_at: now.toISOString(),
    last_repair_action_status: 'ok',
    last_repair_action_error: undefined
  });

  try {
    let resultAgentRun: Awaited<ReturnType<typeof runResultsAgentCycle>> | undefined;
    let scorerRepair: Awaited<ReturnType<typeof backfillTopScorersFromConfirmedResults>> | undefined;
    if (input.action === 'catch-up') {
      resultAgentRun = await runResultsAgentCycle(now);
    }

    if (input.action === 'resync-scorers-from-confirmed-results') {
      scorerRepair = await backfillTopScorersFromConfirmedResults(database, now.toISOString());
    }

    if (input.action === 'catch-up' || input.action === 'rebuild-public-dashboard' || input.action === 'rebuild-group-standings') {
      await rebuildGroupStandingsCache(database, now);
    }

    if (input.action === 'catch-up' || input.action === 'rebuild-public-dashboard' || input.action === 'rebuild-leaderboard') {
      await rebuildPublicTournamentState(database, now);
    }

    if (input.action === 'catch-up' || input.action === 'rebuild-public-dashboard' || input.action === 'rebuild-top-scorers') {
      await rebuildTopScorerStandings(database, now.toISOString());
    }

    await writePublicStateMetadata(database, {
      last_public_snapshot_rebuild_at: now.toISOString(),
      last_repair_action: input.action,
      last_repair_action_at: now.toISOString(),
      last_repair_action_status: 'ok',
      last_repair_action_error: undefined
    });

    const leaderboardRowsCount = await countRows(database, 'leaderboard_entries');
    const topScorerRowsCount = await countRows(database, 'top_scorer_standings');
    const groupStandingsRowsCount = await countRows(database, 'group_standings');

    return {
      action: input.action,
      status: 'ok',
      message: summarizeRepairMessage(input.action, resultAgentRun, scorerRepair),
      generatedAt: now.toISOString(),
      publicSnapshotRebuiltAt: now.toISOString(),
      resultAgentRun,
      leaderboardRowsCount,
      topScorerRowsCount,
      groupStandingsRowsCount
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writePublicStateMetadata(database, {
      last_repair_action: input.action,
      last_repair_action_at: now.toISOString(),
      last_repair_action_status: 'failed',
      last_repair_action_error: message
    });
    return {
      action: input.action,
      status: 'failed',
      message,
      generatedAt: now.toISOString(),
      publicSnapshotRebuiltAt: now.toISOString(),
      leaderboardRowsCount: await countRows(database, 'leaderboard_entries').catch(() => 0),
      topScorerRowsCount: await countRows(database, 'top_scorer_standings').catch(() => 0),
      groupStandingsRowsCount: await countRows(database, 'group_standings').catch(() => 0)
    };
  }
}

export async function runFullSafeRebuild(input: {
  db?: QueryableDatabase;
  now?: Date;
  steps?: FullSafeRebuildStepDefinition[];
} = {}): Promise<FullSafeRebuildResult> {
  const database = input.db ?? db;
  const now = input.now ?? new Date();
  await migrateResultPersistenceSchema(database);

  const result = await runFullSafeRebuildSequence({
    now,
    steps: input.steps ?? buildFullSafeRebuildSteps(database, now)
  });

  const metadataPatch: Partial<PublicStateMetadataRow> = {
    last_repair_action: 'full-safe-rebuild',
    last_repair_action_at: now.toISOString(),
    last_repair_action_status: result.status,
    last_repair_action_error: result.status === 'failed' ? result.failedStep?.message ?? result.message : undefined
  };
  if (result.summary.publicDashboardRebuiltAt) {
    metadataPatch.last_public_snapshot_rebuild_at = result.summary.publicDashboardRebuiltAt;
  }
  await writePublicStateMetadata(database, metadataPatch);

  return result;
}

export async function runFullSafeRebuildSequence(input: {
  now: Date;
  steps: FullSafeRebuildStepDefinition[];
}): Promise<FullSafeRebuildResult> {
  const summary = emptyFullSafeRebuildSummary();
  const steps: FullSafeRebuildStepResult[] = [];
  const stepsCompleted: string[] = [];
  for (const step of input.steps) {
    try {
      const result = await step.run();
      mergeFullSafeRebuildSummary(summary, result.summary);
      const stepResult: FullSafeRebuildStepResult = {
        step: step.step,
        label: step.label,
        status: 'ok',
        message: result.message,
        details: result.details
      };
      steps.push(stepResult);
      stepsCompleted.push(step.label);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failedStep: FullSafeRebuildStepResult = {
        step: step.step,
        label: step.label,
        status: 'failed',
        message
      };
      steps.push(failedStep);
      return {
        status: 'failed',
        message: `Full safe rebuild stopped at ${step.label}: ${message}`,
        generatedAt: input.now.toISOString(),
        stepsCompleted,
        failedStep,
        steps,
        summary
      };
    }
  }

  return {
    status: 'ok',
    message: `Full safe rebuild completed: ${stepsCompleted.length} step(s) completed.`,
    generatedAt: input.now.toISOString(),
    stepsCompleted,
    steps,
    summary
  };
}

function buildFullSafeRebuildSteps(database: QueryableDatabase, now: Date): FullSafeRebuildStepDefinition[] {
  const nowIso = now.toISOString();
  return [
    {
      step: 'result-agent-catch-up',
      label: 'Run result-agent catch-up',
      async run() {
        const result = await runResultsAgentCycle(now);
        return {
          message: `Result-agent catch-up completed: ${result.updatedMatches} match update(s), ${result.finalizedResults} finalized.`,
          summary: { scoresUpdated: result.updatedMatches },
          details: {
            checkedMatches: result.checkedMatches,
            updatedMatches: result.updatedMatches,
            finalizedResults: result.finalizedResults,
            warningsCount: result.warnings.length
          }
        };
      }
    },
    {
      step: 'resync-scorers-from-confirmed-results',
      label: 'Re-sync scorers from confirmed provider results',
      async run() {
        const result = await backfillTopScorersFromConfirmedResults(database, nowIso);
        return {
          message: result.repaired
            ? `Scorer facts re-synced for ${result.repairedMatches} confirmed match(es).`
            : summarizeRepairMessage('resync-scorers-from-confirmed-results', undefined, result),
          summary: {
            scorerFactsInserted: result.scorerFactsInserted,
            scorerFactsUpdated: result.scorerFactsUpdated,
            scorerFactsSkipped: result.scorerFactsSkipped
          },
          details: {
            repairedMatches: result.repairedMatches,
            reason: result.reason
          }
        };
      }
    },
    {
      step: 'rebuild-group-standings',
      label: 'Rebuild group standings',
      async run() {
        const rows = await rebuildGroupStandingsCacheFromConfirmedResults(database, now);
        return {
          message: `Group standings rebuilt with ${rows} row(s).`,
          summary: {
            groupStandingsRebuilt: true,
            groupStandingsRowsCount: rows
          },
          details: { rows }
        };
      }
    },
    {
      step: 'rebuild-leaderboard',
      label: 'Rebuild leaderboard',
      async run() {
        const result = await rebuildLeaderboardCacheFromConfirmedResults(database, now);
        const rows = result?.entries.length ?? await countRows(database, 'leaderboard_entries');
        return {
          message: result
            ? `Leaderboard rebuilt for ${result.playersProcessed} player(s).`
            : 'Leaderboard rebuild skipped because no confirmed results exist.',
          summary: {
            leaderboardRebuilt: Boolean(result),
            leaderboardRowsCount: rows
          },
          details: {
            rows,
            playersProcessed: result?.playersProcessed ?? 0,
            matchesProcessed: result?.matchesProcessed ?? 0,
            changedEntries: result?.changedEntries ?? 0
          }
        };
      }
    },
    {
      step: 'rebuild-top-scorers',
      label: 'Rebuild top scorer standings',
      async run() {
        await rebuildTopScorerStandings(database, nowIso);
        const rows = await countRows(database, 'top_scorer_standings');
        return {
          message: `Top scorer standings rebuilt with ${rows} row(s).`,
          summary: {
            topScorerStandingsRebuilt: true,
            topScorerRowsCount: rows
          },
          details: { rows }
        };
      }
    },
    {
      step: 'rebuild-public-dashboard',
      label: 'Rebuild public dashboard state',
      async run() {
        await markPublicDashboardStateRebuilt(database, nowIso);
        return {
          message: 'Public dashboard state rebuilt from confirmed cached facts.',
          summary: {
            publicDashboardRebuilt: true,
            publicDashboardRebuiltAt: nowIso
          },
          details: { rebuiltAt: nowIso }
        };
      }
    }
  ];
}

export async function queuePublicStateRepairIfStale(input: {
  db?: QueryableDatabase;
  now?: Date;
  resultAgentStatus?: ResultAgentStatus;
} = {}): Promise<PublicStateRepairResult | undefined> {
  const database = input.db ?? db;
  const now = input.now ?? new Date();
  if (repairInFlight) return repairInFlight;

  const diagnostics = await collectPublicStateDiagnostics({ db: database, now, resultAgentStatus: input.resultAgentStatus });
  if (!diagnostics.staleState) return undefined;

  const action = choosePublicStateRepairAction(diagnostics);
  if (!action) return undefined;

  repairInFlight = runPublicStateRepairAction({
    action,
    db: database,
    now,
    reason: diagnostics.staleReasons.join('; ')
  })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      return {
        action,
        status: 'failed' as const,
        message,
        generatedAt: now.toISOString(),
        publicSnapshotRebuiltAt: now.toISOString(),
        leaderboardRowsCount: 0,
        topScorerRowsCount: 0,
        groupStandingsRowsCount: 0
      };
    })
    .finally(() => {
      repairInFlight = undefined;
    });

  return repairInFlight;
}

export function choosePublicStateRepairAction(diagnostics: PublicStateDiagnostics): PublicStateRepairAction | undefined {
  if (diagnostics.confirmedGoalsCount > 0 && diagnostics.scorerFactsCount === 0 && diagnostics.providerScorerDataDetected !== 'no') {
    return 'resync-scorers-from-confirmed-results';
  }
  if (diagnostics.confirmedGoalsCount > 0 && diagnostics.scorerFactsGoalsCount !== diagnostics.confirmedGoalsCount && diagnostics.providerScorerDataDetected !== 'no') {
    return 'resync-scorers-from-confirmed-results';
  }
  const needsFullRebuild = diagnostics.staleReasons.some((reason) =>
    /latest public results are empty|stored group standings are empty|Leaderboard cache has/i.test(reason)
  );
  if (needsFullRebuild) {
    return 'rebuild-public-dashboard';
  }
  const scorerOnlyStale = diagnostics.scorerFactsCount > 0 &&
    diagnostics.topScorerRowsCount === 0 &&
    diagnostics.staleReasons.length === 1 &&
    diagnostics.staleReasons[0]?.includes('stored top scorer standings are empty');
  if (scorerOnlyStale) {
    return 'rebuild-top-scorers';
  }
  if (diagnostics.topScorerNameAnomaliesCount > 0 || diagnostics.topScorerGoalsCount !== diagnostics.scorerFactsGoalsCount) {
    return 'rebuild-top-scorers';
  }
  if (diagnostics.staleState) {
    return 'rebuild-public-dashboard';
  }
  return undefined;
}

async function rebuildGroupStandingsCache(db: QueryableDatabase, now: Date): Promise<void> {
  const standings = await calculateGroupStandings(db);
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM group_standings');
    for (const group of standings) {
      for (const team of group.teams) {
        const teamId = await teamIdForName(tx, team.team);
        if (!teamId) continue;
        await tx.run(
          `INSERT INTO group_standings (
            group_id, team_id, rank, played, wins, draws, losses, goals_for, goals_against, goal_difference, points, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [group.group, teamId, team.rank, team.played, team.wins, team.draws, team.losses, team.goalsFor, team.goalsAgainst, team.goalDifference, team.points, now.toISOString()]
        );
      }
    }
  });
}

async function calculateGroupStandings(db: QueryableDatabase): Promise<Array<{
  group: string;
  teams: Array<{
    rank: number;
    team: string;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    points: number;
  }>;
}>> {
  const teams = await db.all('SELECT id, name, group_id FROM teams WHERE group_id IS NOT NULL ORDER BY group_id, id');
  const standings = new Map<string, {
    groupId: string;
    teamId: string;
    teamName: string;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    points: number;
  }>();
  for (const team of teams) {
    const groupId = String(team.group_id);
    const teamId = String(team.id);
    standings.set(teamId, {
      groupId,
      teamId,
      teamName: String(team.name),
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0
    });
  }

  const results = await db.all(`
    SELECT m.home_team_id, m.away_team_id, r.confirmed_home_score, r.confirmed_away_score
    FROM match_results r
    JOIN matches m ON m.id = r.match_id
    WHERE r.public_status = 'CONFIRMED_FINAL' AND r.is_final = 1 AND m.stage = 'GROUP'
  `);

  for (const result of results) {
    const home = standings.get(String(result.home_team_id));
    const away = standings.get(String(result.away_team_id));
    if (!home || !away) continue;
    applyResult(home, Number(result.confirmed_home_score), Number(result.confirmed_away_score));
    applyResult(away, Number(result.confirmed_away_score), Number(result.confirmed_home_score));
  }

  const groups = [...new Set([...standings.values()].map((row) => row.groupId))].sort();
  return groups.map((group) => {
    const rows = [...standings.values()]
      .filter((row) => row.groupId === group)
      .sort((a, b) =>
        b.points - a.points ||
        goalDifference(b) - goalDifference(a) ||
        b.goalsFor - a.goalsFor ||
        a.teamName.localeCompare(b.teamName)
      );
    return {
      group,
      teams: rows.map((row, index) => ({
        rank: index + 1,
        team: row.teamName,
        played: row.played,
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDifference: goalDifference(row),
        points: row.points
      }))
    };
  });
}

async function countConfirmedResults(db: QueryableDatabase): Promise<number> {
  return Number((await db.one(`
    SELECT COUNT(*) AS count
    FROM match_results
    WHERE ${CONFIRMED_FINAL_RESULT_SQL}
  `))?.count ?? 0);
}

async function countLiveMatches(db: QueryableDatabase, now: Date): Promise<number> {
  const rows = await db.all(`
    SELECT
      m.kickoff_at,
      r.public_status,
      r.is_final,
      r.confirmed_home_score,
      r.confirmed_away_score
    FROM matches m
    LEFT JOIN match_results r ON r.match_id = m.id
    ORDER BY m.kickoff_at, m.id
  `);
  return rows.filter((row) => classifyPublicMatchState({
    kickoffAt: String(row.kickoff_at),
    publicStatus: String(row.public_status ?? 'SCHEDULED'),
    isConfirmedFinal: isConfirmedFinalResult(row),
    now
  }) === 'live').length;
}

async function countAggregatedScorerRows(db: QueryableDatabase): Promise<number> {
  return Number((await db.one(`
    SELECT COUNT(*) AS count FROM (
      SELECT player_name, COALESCE(team_id, team_code) AS team_key
      FROM result_manual_scorers
      GROUP BY player_name, COALESCE(team_id, team_code)
    )
  `))?.count ?? 0);
}

async function readLastResultSyncAt(db: QueryableDatabase): Promise<string | undefined> {
  const run = await db.one(`
    SELECT MAX(finished_at) AS finished_at
    FROM result_agent_runs
    WHERE finalized_matches > 0 OR updated_matches > 0
  `).catch(() => null);
  if (run?.finished_at) return String(run.finished_at);
  const confirmed = await db.one(`
    SELECT MAX(confirmed_at) AS confirmed_at
    FROM match_results
    WHERE ${CONFIRMED_FINAL_RESULT_SQL}
  `);
  return confirmed?.confirmed_at ? String(confirmed.confirmed_at) : undefined;
}

async function readLastScorerRebuildAt(db: QueryableDatabase): Promise<string | undefined> {
  const row = await db.one(`
    SELECT MAX(updated_at) AS updated_at
    FROM top_scorer_standings
  `);
  return row?.updated_at ? String(row.updated_at) : undefined;
}

async function countConfirmedGoals(db: QueryableDatabase): Promise<number> {
  const row = await db.one(`
    SELECT COALESCE(SUM(COALESCE(confirmed_home_score, home_score, 0) + COALESCE(confirmed_away_score, away_score, 0)), 0) AS total
    FROM match_results
    WHERE ${CONFIRMED_FINAL_RESULT_SQL}
  `);
  return Number(row?.total ?? 0);
}

async function countScorerFactGoals(db: QueryableDatabase): Promise<number> {
  const row = await db.one(`
    SELECT COALESCE(SUM(COALESCE(goals, 0)), 0) AS total
    FROM result_manual_scorers
  `);
  return Number(row?.total ?? 0);
}

async function countTopScorerGoals(db: QueryableDatabase): Promise<number> {
  const row = await db.one(`
    SELECT COALESCE(SUM(COALESCE(goals, 0)), 0) AS total
    FROM top_scorer_standings
  `);
  return Number(row?.total ?? 0);
}

async function countTopScorerNameAnomalies(db: QueryableDatabase): Promise<number> {
  const rows = await db.all(`SELECT player_name FROM top_scorer_standings`);
  return rows.filter((row) => normalizeScorerName(String(row.player_name ?? '')) !== String(row.player_name ?? '').trim()).length;
}

async function countRows(db: QueryableDatabase, table: string): Promise<number> {
  return Number((await db.one(`SELECT COUNT(*) AS count FROM ${table}`))?.count ?? 0);
}

function emptyFullSafeRebuildSummary(): FullSafeRebuildSummary {
  return {
    scoresUpdated: 0,
    scorerFactsInserted: 0,
    scorerFactsUpdated: 0,
    scorerFactsSkipped: 0,
    groupStandingsRebuilt: false,
    groupStandingsRowsCount: 0,
    leaderboardRebuilt: false,
    leaderboardRowsCount: 0,
    topScorerStandingsRebuilt: false,
    topScorerRowsCount: 0,
    publicDashboardRebuilt: false
  };
}

function mergeFullSafeRebuildSummary(summary: FullSafeRebuildSummary, patch?: Partial<FullSafeRebuildSummary>): void {
  if (!patch) return;
  summary.scoresUpdated += patch.scoresUpdated ?? 0;
  summary.scorerFactsInserted += patch.scorerFactsInserted ?? 0;
  summary.scorerFactsUpdated += patch.scorerFactsUpdated ?? 0;
  summary.scorerFactsSkipped += patch.scorerFactsSkipped ?? 0;
  summary.groupStandingsRebuilt = summary.groupStandingsRebuilt || Boolean(patch.groupStandingsRebuilt);
  summary.groupStandingsRowsCount = patch.groupStandingsRowsCount ?? summary.groupStandingsRowsCount;
  summary.leaderboardRebuilt = summary.leaderboardRebuilt || Boolean(patch.leaderboardRebuilt);
  summary.leaderboardRowsCount = patch.leaderboardRowsCount ?? summary.leaderboardRowsCount;
  summary.topScorerStandingsRebuilt = summary.topScorerStandingsRebuilt || Boolean(patch.topScorerStandingsRebuilt);
  summary.topScorerRowsCount = patch.topScorerRowsCount ?? summary.topScorerRowsCount;
  summary.publicDashboardRebuilt = summary.publicDashboardRebuilt || Boolean(patch.publicDashboardRebuilt);
  summary.publicDashboardRebuiltAt = patch.publicDashboardRebuiltAt ?? summary.publicDashboardRebuiltAt;
}

async function detectProviderScorerData(db: QueryableDatabase): Promise<'yes' | 'no' | 'unknown'> {
  const rows = await db.all(`
    SELECT provider_results_json
    FROM match_results
    WHERE ${CONFIRMED_FINAL_RESULT_SQL} AND provider_results_json IS NOT NULL
  `);
  if (rows.length === 0) return 'unknown';
  for (const row of rows) {
    const observations = parseProviderResults(row.provider_results_json);
    if (observations.some((observation) => Array.isArray(observation.scorers) && observation.scorers.length > 0)) {
      return 'yes';
    }
  }
  return 'no';
}

function parseProviderResults(value: unknown): Array<{ scorers?: unknown }> {
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is { scorers?: unknown } => Boolean(item) && typeof item === 'object');
  } catch {
    return [];
  }
}

async function readPublicStateMetadata(db: QueryableDatabase): Promise<PublicStateMetadataRow> {
  const row = await db.one(`SELECT * FROM public_state_metadata WHERE id = ?`, [METADATA_ID]).catch(() => null);
  return {
    id: METADATA_ID,
    last_public_dashboard_read_at: row?.last_public_dashboard_read_at ? String(row.last_public_dashboard_read_at) : undefined,
    last_public_snapshot_rebuild_at: row?.last_public_snapshot_rebuild_at ? String(row.last_public_snapshot_rebuild_at) : undefined,
    last_repair_action: row?.last_repair_action ? String(row.last_repair_action) : undefined,
    last_repair_action_at: row?.last_repair_action_at ? String(row.last_repair_action_at) : undefined,
    last_repair_action_status: row?.last_repair_action_status ? String(row.last_repair_action_status) : undefined,
    last_repair_action_error: row?.last_repair_action_error ? String(row.last_repair_action_error) : undefined
  };
}

async function writePublicStateMetadata(db: QueryableDatabase, patch: Partial<PublicStateMetadataRow>): Promise<void> {
  const current = await readPublicStateMetadata(db);
  const next: PublicStateMetadataRow = { ...current, ...patch };
  await db.run(
    `INSERT INTO public_state_metadata (
      id, last_public_dashboard_read_at, last_public_snapshot_rebuild_at,
      last_repair_action, last_repair_action_at, last_repair_action_status, last_repair_action_error
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      last_public_dashboard_read_at = excluded.last_public_dashboard_read_at,
      last_public_snapshot_rebuild_at = excluded.last_public_snapshot_rebuild_at,
      last_repair_action = excluded.last_repair_action,
      last_repair_action_at = excluded.last_repair_action_at,
      last_repair_action_status = excluded.last_repair_action_status,
      last_repair_action_error = excluded.last_repair_action_error`,
    [
      METADATA_ID,
      next.last_public_dashboard_read_at ?? null,
      next.last_public_snapshot_rebuild_at ?? null,
      next.last_repair_action ?? null,
      next.last_repair_action_at ?? null,
      next.last_repair_action_status ?? null,
      next.last_repair_action_error ?? null
    ]
  );
}

function buildStaleReasons(input: {
  confirmedResultsCount: number;
  confirmedGoalsCount: number;
  latestResultsCount: number;
  groupStandingsRowsCount: number;
  leaderboardCacheRowsCount: number;
  canonicalLeaderboardRowsCount: number;
  scorerFactsCount: number;
  scorerFactsGoalsCount: number;
  topScorerRowsCount: number;
  topScorerCacheRowsCount: number;
  topScorerGoalsCount: number;
  topScorerNameAnomaliesCount: number;
  providerScorerDataDetected: 'yes' | 'no' | 'unknown';
}): string[] {
  const reasons: string[] = [];
  if (input.confirmedResultsCount > 0 && input.latestResultsCount === 0) reasons.push('Confirmed results exist, but latest public results are empty.');
  if (input.confirmedResultsCount > 0 && input.groupStandingsRowsCount === 0) reasons.push('Confirmed results exist, but stored group standings are empty.');
  if (input.leaderboardCacheRowsCount < input.canonicalLeaderboardRowsCount && input.confirmedResultsCount > 0) {
    reasons.push(`Leaderboard cache has ${input.leaderboardCacheRowsCount} rows but canonical import expects ${input.canonicalLeaderboardRowsCount}.`);
  }
  if (input.confirmedResultsCount > 0 && input.confirmedGoalsCount > 0 && input.scorerFactsCount === 0 && input.providerScorerDataDetected !== 'no') {
    reasons.push('Confirmed results exist, but no scorer facts are available. Provider may not supply scorer data or scorer sync failed.');
  }
  if (input.confirmedResultsCount > 0 && input.scorerFactsGoalsCount > input.confirmedGoalsCount) {
    reasons.push('Scorer facts exceed confirmed match goal total. Scorer sync may be duplicating or assigning team goals per player.');
  }
  if (input.topScorerNameAnomaliesCount > 0) {
    reasons.push('Stored top scorer standings still contain unnormalized scorer names and need a rebuild.');
  }
  if (input.scorerFactsCount > 0 && input.topScorerRowsCount > 0 && input.topScorerGoalsCount !== input.scorerFactsGoalsCount) {
    reasons.push('Stored top scorer standings are out of sync with scorer facts.');
  }
  if (input.scorerFactsCount > 0 && input.topScorerCacheRowsCount === 0) {
    reasons.push('Scorer facts exist, but stored top scorer standings are empty.');
  }
  return reasons;
}

function deriveOperatorStatus(
  resultAgentStatus: ResultAgentStatus,
  staleReasons: string[],
  metadata: PublicStateMetadataRow
): 'OK' | 'Needs sync' | 'Running' | 'Failed' {
  if (metadata.last_repair_action_status === 'failed') return 'Failed';
  if (resultAgentStatus.providerReachable === false) return 'Failed';
  if (staleReasons.length > 0) return 'Needs sync';
  return 'OK';
}

function summarizeRepairMessage(
  action: PublicStateRepairAction,
  resultAgentRun?: Awaited<ReturnType<typeof runResultsAgentCycle>>,
  scorerRepair?: Awaited<ReturnType<typeof backfillTopScorersFromConfirmedResults>>
): string {
  if (action === 'catch-up') {
    const finalized = resultAgentRun?.finalizedResults ?? 0;
    return finalized > 0 ? `Result-agent catch-up completed with ${finalized} finalized match(es).` : 'Result-agent catch-up completed without new final results.';
  }
  if (action === 'rebuild-public-dashboard') return 'Public dashboard caches were rebuilt from confirmed facts.';
  if (action === 'rebuild-group-standings') return 'Group standings cache was rebuilt from confirmed results.';
  if (action === 'rebuild-leaderboard') return 'Leaderboard cache was rebuilt from confirmed results and predictions.';
  if (action === 'resync-scorers-from-confirmed-results') {
    if (scorerRepair?.repaired) return 'Scorers were re-synced from confirmed provider results.';
    if (scorerRepair?.reason === 'no-confirmed-results') return 'No confirmed results were available for scorer sync.';
    if (scorerRepair?.reason === 'no-provider-scorers-found') return 'Provider did not return scorer data for confirmed matches.';
    return 'Scorer sync completed.';
  }
  return 'Top scorer standings cache was rebuilt from confirmed scorer facts.';
}

function normalizeRepairAction(value?: string): PublicStateRepairAction | undefined {
  if (!value || !REPAIR_ACTIONS.has(value)) return undefined;
  return value as PublicStateRepairAction;
}

function normalizeRepairStatus(value?: string): 'ok' | 'failed' | undefined {
  if (!value) return undefined;
  if (value === 'ok' || value === 'failed') return value;
  return undefined;
}

async function teamIdForName(db: QueryableDatabase, teamName: string): Promise<string | undefined> {
  const row = await db.one('SELECT id FROM teams WHERE id = ? OR name = ? OR name_et = ? LIMIT 1', [teamName, teamName, teamName]);
  return row?.id ? String(row.id) : undefined;
}

function applyResult(row: {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}, goalsFor: number, goalsAgainst: number): void {
  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  if (goalsFor > goalsAgainst) {
    row.wins += 1;
    row.points += 3;
  } else if (goalsFor === goalsAgainst) {
    row.draws += 1;
    row.points += 1;
  } else {
    row.losses += 1;
  }
}

function goalDifference(row: { goalsFor: number; goalsAgainst: number }): number {
  return row.goalsFor - row.goalsAgainst;
}
