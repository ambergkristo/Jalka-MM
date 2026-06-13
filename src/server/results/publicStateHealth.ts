import type { QueryableDatabase } from '../databaseAdapter.js';
import { predictionRepository } from '../../domain/predictionRepository.js';
import { db } from '../db.js';
import { DatabaseResultRepository } from './databaseResultRepository.js';
import { getCurrentLeaderboard, getResultsAgentStatus, runResultsAgentCycle } from './resultAgentRuntime.js';
import { migrateResultPersistenceSchema } from './resultPersistenceSchema.js';
import { rebuildTopScorerStandings } from './topScorerStandings.js';
import type { ResultAgentStatus } from './resultTypes.js';

const METADATA_ID = 'public-state';
const REPAIR_ACTIONS = new Set(['catch-up', 'rebuild-public-dashboard', 'rebuild-group-standings', 'rebuild-leaderboard', 'rebuild-top-scorers']);

let repairInFlight: Promise<PublicStateRepairResult | undefined> | undefined;

export type PublicStateRepairAction =
  | 'catch-up'
  | 'rebuild-public-dashboard'
  | 'rebuild-group-standings'
  | 'rebuild-leaderboard'
  | 'rebuild-top-scorers';

export interface PublicStateDiagnostics {
  generatedAt: string;
  serverTime: string;
  resultAgentStatus: ResultAgentStatus;
  confirmedResultsCount: number;
  liveMatchesCount: number;
  latestResultsCount: number;
  groupStandingsSource: 'computed-from-confirmed-results';
  groupStandingsRowsCount: number;
  topScorerRowsCount: number;
  leaderboardRowsCount: number;
  canonicalLeaderboardRowsCount: number;
  topScorerCacheRowsCount: number;
  leaderboardCacheRowsCount: number;
  lastResultSyncAt?: string;
  lastPublicDashboardReadAt?: string;
  lastPublicSnapshotRebuildAt?: string;
  lastProviderCheckAt?: string;
  lastLeaderboardRebuildAt?: string;
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
  const liveMatchesCount = await countLiveMatches(database, now);
  const latestResultsCount = Math.min(confirmedResultsCount, 8);
  const groupStandingsRowsCount = await countRows(database, 'group_standings');
  const leaderboardCacheRowsCount = await countRows(database, 'leaderboard_entries');
  const topScorerCacheRowsCount = await countRows(database, 'top_scorer_standings');
  const topScorerRowsCount = await countAggregatedScorerRows(database);
  const canonicalLeaderboardRowsCount = predictionRepository.getPlayers().length;
  const leaderboardRowsCount = leaderboardCacheRowsCount;
  const lastResultSyncAt = await readLastResultSyncAt(database);
  const staleReasons = buildStaleReasons({
    confirmedResultsCount,
    latestResultsCount,
    groupStandingsRowsCount,
    leaderboardCacheRowsCount,
    canonicalLeaderboardRowsCount,
    topScorerRowsCount,
    topScorerCacheRowsCount
  });
  const operatorStatus = deriveOperatorStatus(resultAgentStatus, staleReasons, metadata);

  return {
    generatedAt: now.toISOString(),
    serverTime: now.toISOString(),
    resultAgentStatus,
    confirmedResultsCount,
    liveMatchesCount,
    latestResultsCount,
    groupStandingsSource: 'computed-from-confirmed-results',
    groupStandingsRowsCount,
    topScorerRowsCount,
    leaderboardRowsCount,
    canonicalLeaderboardRowsCount,
    topScorerCacheRowsCount,
    leaderboardCacheRowsCount,
    lastResultSyncAt,
    lastPublicDashboardReadAt: metadata.last_public_dashboard_read_at,
    lastPublicSnapshotRebuildAt: metadata.last_public_snapshot_rebuild_at,
    lastProviderCheckAt: resultAgentStatus.lastRunAt ?? undefined,
    lastLeaderboardRebuildAt: resultAgentStatus.lastLeaderboardRebuildAt ?? undefined,
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
    if (input.action === 'catch-up') {
      resultAgentRun = await runResultsAgentCycle(now);
    }

    if (input.action === 'catch-up' || input.action === 'rebuild-public-dashboard' || input.action === 'rebuild-group-standings') {
      await rebuildGroupStandingsCache(database, now);
    }

    if (input.action === 'catch-up' || input.action === 'rebuild-public-dashboard' || input.action === 'rebuild-leaderboard') {
      const repository = new DatabaseResultRepository(database);
      await getCurrentLeaderboard(repository);
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
      message: summarizeRepairMessage(input.action, resultAgentRun),
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

  repairInFlight = runPublicStateRepairAction({
    action: 'rebuild-public-dashboard',
    db: database,
    now,
    reason: diagnostics.staleReasons.join('; ')
  })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      return {
        action: 'rebuild-public-dashboard' as const,
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
    WHERE public_status = 'CONFIRMED_FINAL' AND is_final = 1
  `))?.count ?? 0);
}

async function countLiveMatches(db: QueryableDatabase, now: Date): Promise<number> {
  const rows = await db.all(`
    SELECT
      m.kickoff_at,
      r.public_status,
      r.is_final
    FROM matches m
    LEFT JOIN match_results r ON r.match_id = m.id
    ORDER BY m.kickoff_at, m.id
  `);
  return rows.filter((row) => classifyMatchState(String(row.kickoff_at), String(row.public_status ?? 'SCHEDULED'), Number(row.is_final ?? 0), now) === 'live').length;
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
    WHERE public_status = 'CONFIRMED_FINAL' AND is_final = 1
  `);
  return confirmed?.confirmed_at ? String(confirmed.confirmed_at) : undefined;
}

async function countRows(db: QueryableDatabase, table: string): Promise<number> {
  return Number((await db.one(`SELECT COUNT(*) AS count FROM ${table}`))?.count ?? 0);
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
  latestResultsCount: number;
  groupStandingsRowsCount: number;
  leaderboardCacheRowsCount: number;
  canonicalLeaderboardRowsCount: number;
  topScorerRowsCount: number;
  topScorerCacheRowsCount: number;
}): string[] {
  const reasons: string[] = [];
  if (input.confirmedResultsCount > 0 && input.latestResultsCount === 0) reasons.push('Confirmed results exist, but latest public results are empty.');
  if (input.confirmedResultsCount > 0 && input.groupStandingsRowsCount === 0) reasons.push('Confirmed results exist, but stored group standings are empty.');
  if (input.leaderboardCacheRowsCount < input.canonicalLeaderboardRowsCount && input.confirmedResultsCount > 0) {
    reasons.push(`Leaderboard cache has ${input.leaderboardCacheRowsCount} rows but canonical import expects ${input.canonicalLeaderboardRowsCount}.`);
  }
  if (input.topScorerRowsCount > 0 && input.topScorerCacheRowsCount === 0) {
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

function summarizeRepairMessage(action: PublicStateRepairAction, resultAgentRun?: Awaited<ReturnType<typeof runResultsAgentCycle>>): string {
  if (action === 'catch-up') {
    const finalized = resultAgentRun?.finalizedResults ?? 0;
    return finalized > 0 ? `Result-agent catch-up completed with ${finalized} finalized match(es).` : 'Result-agent catch-up completed without new final results.';
  }
  if (action === 'rebuild-public-dashboard') return 'Public dashboard caches were rebuilt from confirmed facts.';
  if (action === 'rebuild-group-standings') return 'Group standings cache was rebuilt from confirmed results.';
  if (action === 'rebuild-leaderboard') return 'Leaderboard cache was rebuilt from confirmed results and predictions.';
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

function classifyMatchState(kickoffAt: string, publicStatus: string, isFinal: number, now: Date): 'live' | 'today' | 'upcoming' | 'finished' {
  const kickoffMs = Date.parse(kickoffAt);
  if (Number.isNaN(kickoffMs)) return 'upcoming';
  if (Number(isFinal) === 1 && publicStatus === 'CONFIRMED_FINAL') return 'finished';
  if (kickoffMs <= now.getTime()) return 'live';
  return sameTallinnDate(kickoffAt, now) ? 'today' : 'upcoming';
}

function sameTallinnDate(kickoffAt: string, now: Date): boolean {
  const formatter = new Intl.DateTimeFormat('et-EE', {
    timeZone: 'Europe/Tallinn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date(kickoffAt)) === formatter.format(now);
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
