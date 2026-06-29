import { getResultAgentStatus, runResultUpdateCycle } from './resultAgent.js';
import { getManualResultPermission as resolveManualResultPermission, getResultAgentRunPermission as resolveResultAgentRunPermission } from './resultAgentSecurity.js';
import { loadResultProviderConfig } from './resultProviderConfig.js';
import { createResultProvider } from './resultProviderFactory.js';
import { db } from '../db.js';
import { buildCanonicalPublicLeaderboardEntries } from '../../domain/publicLeaderboard.js';
import type { LeaderboardEntry } from '../../domain/predictionRepository.js';
import { DatabaseResultRepository } from './databaseResultRepository.js';
import type { LeaderboardRepository } from './leaderboardRepository.js';
import { confirmManualResult, type ManualResultConfirmationInput } from './manualResultCorrection.js';
import { backfillTopScorersFromConfirmedResults, countVisibleScorerFactGoals, rebuildTopScorerStandings, syncConfirmedScorersForMatch } from './topScorerStandings.js';
import type { ResultUpdate, ResultsAgentRepository } from './resultTypes.js';
import { normalizeScorerName } from './scorerNormalization.js';
import { CONFIRMED_FINAL_RESULT_SQL } from './finalizedResultState.js';
import { buildConfiguredActualScoringState } from './scoringState.js';
import { repairPersistedLeaderboardSnapshot as repairPersistedLeaderboardSnapshotImpl } from './leaderboardRepair.js';
import { buildLeaderboardScoringBreakdown } from './leaderboardScoring.js';
import { deleteThirdPlaceQualifierLockForGroup, listThirdPlaceQualifierLocks, upsertThirdPlaceQualifierLock, type ThirdPlaceQualifierLockInput } from './thirdPlaceQualifierLocks.js';
import { buildCanonicalPlayoffState } from './playoffState.js';
import type { ResultProvider } from './resultProvider.js';

const repository = new DatabaseResultRepository(db);
const providerConfig = loadResultProviderConfig();
const provider = createResultProvider(providerConfig);
let catchUpInFlight: Promise<void> | undefined;

export interface PlayoffRepairMatchStatus {
  matchNumber: number;
  foundInTrackedMatches: boolean;
  providerFixtureId?: number;
  providerStatus?: string;
  providerScore?: string;
  persistedStatus?: string;
  confirmedHomeScore?: number;
  confirmedAwayScore?: number;
  persistedIsConfirmedFinal: boolean;
  includedInHealthConfirmed: boolean;
  includedInPlayedCount: boolean;
  includedInLatestResults: boolean;
  canadaInR16: boolean;
  snapshotRebuilt: boolean;
  leaderboardRebuilt: boolean;
}

export interface PlayoffRepairStatus {
  lastRepairStartedAt?: string;
  lastRepairFinishedAt?: string;
  checked: number;
  repaired: number;
  errors: string[];
  match73?: PlayoffRepairMatchStatus;
}

export function getResultsAgentStatus(now = new Date()) {
  return getResultAgentStatus({ repository, provider, now }).then((status) => ({
    ...status,
    providerChain: providerConfig.providerChain,
    writeMode: providerConfig.writeMode
  }));
}

export function getResultsAgentRunPermission(input: { dryRunRequested?: boolean; providedSecret?: string }) {
  return resolveResultAgentRunPermission({ config: providerConfig, ...input });
}

export function getManualResultPermission(input: { providedSecret?: string }) {
  return resolveManualResultPermission({ config: providerConfig, ...input });
}

export function runResultsAgentCycle(now = new Date(), options: { dryRun?: boolean } = {}) {
  return runResultUpdateCycle({
    repository,
    leaderboardRepository: repository,
    provider,
    now,
    dryRun: options.dryRun ?? providerConfig.writeMode === 'dry-run',
    confirmationDelayMinutes: providerConfig.confirmationDelayMinutes
  });
}

export function repairPlayoffResults(now = new Date(), options: { dryRun?: boolean } = {}) {
  return repairPlayoffResultsWith({
    repository,
    leaderboardRepository: repository,
    provider,
    now,
    dryRun: options.dryRun ?? providerConfig.writeMode === 'dry-run',
    confirmationDelayMinutes: providerConfig.confirmationDelayMinutes,
    db
  });
}

export async function repairPlayoffResultsWith(input: {
  repository: ResultsAgentRepository & { refreshDerivedTournamentState?: (timestamp: string) => Promise<unknown> };
  leaderboardRepository: LeaderboardRepository;
  provider: ResultProvider;
  now: Date;
  db: typeof db;
  dryRun?: boolean;
  confirmationDelayMinutes?: number;
}): Promise<PlayoffRepairStatus> {
  const startedAt = input.now.toISOString();
  const trackedMatches = await input.repository.listTrackedMatches();
  const playoffMatches = trackedMatches.filter((match) => match.stage && match.stage !== 'GROUP' && !match.isFinal);
  const errors: string[] = [];
  let checked = 0;
  let repaired = 0;
  let snapshotRebuilt = false;
  let leaderboardRebuilt = false;
  console.info('[playoff-repair] started', { startedAt, checkedMatches: playoffMatches.length });

  if (playoffMatches.length === 0) {
    const fallbackRun = await runResultsAgentCycle(input.now, { dryRun: input.dryRun });
    console.info('[playoff-repair] completed', {
      checked: fallbackRun.checkedMatches,
      repaired: fallbackRun.finalizedResults,
      errors: errors.length
    });
    return {
      lastRepairStartedAt: startedAt,
      lastRepairFinishedAt: fallbackRun.finishedAt,
      checked: fallbackRun.checkedMatches,
      repaired: fallbackRun.finalizedResults,
      errors,
      match73: await buildPlayoffRepairMatchStatus(input.db, input.repository, input.provider, input.now, {
        snapshotRebuilt: fallbackRun.leaderboardRebuilt,
        leaderboardRebuilt: fallbackRun.leaderboardRebuilt
      }).catch(() => undefined)
    };
  }

  for (const match of playoffMatches) {
    checked += 1;
    console.info(`[playoff-repair] checking match #${match.id} providerFixtureId=${match.providerMatchId ?? 'unknown'}`);
    try {
      const preview = await input.provider.fetchMatchUpdate(match, input.now);
      console.info(`[playoff-repair] provider status=${preview.rawProviderStatus ?? preview.status} score=${formatScore(preview.homeScore, preview.awayScore) ?? 'n/a'} match #${match.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      console.info(`[playoff-repair] provider error match #${match.id}: ${message}`);
    }
  }

  const runSummary = await runResultUpdateCycle({
    repository: input.repository,
    leaderboardRepository: input.leaderboardRepository,
    provider: input.provider,
    now: input.now,
    dryRun: input.dryRun ?? providerConfig.writeMode === 'dry-run',
    confirmationDelayMinutes: input.confirmationDelayMinutes,
    matchIds: playoffMatches.map((match) => match.id)
  });

  repaired = runSummary.finalizedResults;
  const refresh = await input.repository.refreshDerivedTournamentState?.(input.now.toISOString());
  snapshotRebuilt = Boolean(refresh) || runSummary.leaderboardRebuilt;
  leaderboardRebuilt = Boolean(refresh) || runSummary.leaderboardRebuilt;
  const repairedMatch73 = await input.repository.getMatchResult(73).catch(() => undefined);
  if (repairedMatch73?.isFinal && repairedMatch73.publicStatus === 'CONFIRMED_FINAL') {
    console.info('[playoff-repair] persisted match #73 as CONFIRMED_FINAL');
  }
  if (snapshotRebuilt || leaderboardRebuilt) {
    console.info('[playoff-repair] rebuilt public snapshot');
    console.info('[playoff-repair] rebuilt leaderboard');
  }

  const match73 = await buildPlayoffRepairMatchStatus(input.db, input.repository, input.provider, input.now, {
    snapshotRebuilt,
    leaderboardRebuilt
  }).catch((error) => {
    errors.push(error instanceof Error ? error.message : String(error));
    return undefined;
  });

  console.info('[playoff-repair] completed', {
    checked,
    repaired,
    errors: errors.length
  });

  return {
    lastRepairStartedAt: startedAt,
    lastRepairFinishedAt: runSummary.finishedAt,
    checked,
    repaired,
    errors,
    match73
  };
}

export function queueResultAgentCatchUp(now = new Date()): Promise<void> | undefined {
  if (providerConfig.writeMode !== 'live') return undefined;
  if (catchUpInFlight) return catchUpInFlight;

  catchUpInFlight = (async () => {
    await repairPlayoffResults(now);
  })()
    .catch((error) => {
      console.warn('Result agent catch-up failed:', error instanceof Error ? error.message : String(error));
    })
    .finally(() => {
      catchUpInFlight = undefined;
    });

  return catchUpInFlight;
}

export function confirmManualResultRuntime(confirmation: ManualResultConfirmationInput) {
  return confirmManualResult({
    db,
    repository,
    leaderboardRepository: repository,
    confirmation
  });
}

export async function getCurrentLeaderboard(leaderboardRepository: LeaderboardRepository = repository) {
  const persisted = await leaderboardRepository.getLeaderboard();
  const metadata = await leaderboardRepository.getLeaderboardMetadata();
  const source = leaderboardRepository as LeaderboardRepository & { getFinalizedResults?: () => Promise<ResultUpdate[]> };
  const finalizedResults = typeof source.getFinalizedResults === 'function' ? await source.getFinalizedResults() : [];
  const actualScoringState = finalizedResults.length > 0 ? await buildConfiguredActualScoringState(db, new Date()) : undefined;
  const reconciled = await repairPersistedLeaderboardSnapshotImpl({
    leaderboardRepository,
    persistedEntries: persisted,
    finalizedResults,
    now: new Date(),
    actualScoringState
  });
  const canonicalEntries = reconciled?.entries ?? buildCanonicalPublicLeaderboardEntries(persisted);
  const warnings = reconciled?.warnings ?? metadata.warnings;
  const recalculatedAt = reconciled?.recalculatedAt ?? metadata.lastRebuildAt;

  if (persisted.length > 0 || reconciled) {
    return {
      mode: 'persisted',
      recalculatedAt,
      warnings,
      entries: canonicalEntries
    };
  }
  return {
    mode: 'pre-results',
    recalculatedAt,
    warnings,
    entries: canonicalEntries
  };
}

export async function repairTopScorersFromConfirmedResults(now = new Date()) {
  const confirmedResults = await repository.getFinalizedResults();
  if (confirmedResults.length === 0) return { repaired: false, reason: 'no-confirmed-results', repairedMatches: 0 };

  const confirmedGoalsCount = Number((await db.one(`
    SELECT COALESCE(SUM(COALESCE(confirmed_home_score, home_score, 0) + COALESCE(confirmed_away_score, away_score, 0)), 0) AS total
    FROM match_results
    WHERE ${CONFIRMED_FINAL_RESULT_SQL}
  `))?.total ?? 0);
  const scorerFactsCount = Number((await db.one('SELECT COUNT(*) AS count FROM result_manual_scorers'))?.count ?? 0);
  const scorerFactsGoalsCount = Number((await db.one(`
    SELECT COALESCE(SUM(COALESCE(goals, 0)), 0) AS total
    FROM result_manual_scorers
  `))?.total ?? 0);
  const visibleScorerFactsGoalsCount = await countVisibleScorerFactGoals(db);
  const standingsCount = Number((await db.one('SELECT COUNT(*) AS count FROM top_scorer_standings'))?.count ?? 0);
  const standingsRows = await db.all('SELECT player_name, goals FROM top_scorer_standings');
  const hasNameAnomaly = standingsRows.some((row) => normalizeScorerName(String(row.player_name ?? '')) !== String(row.player_name ?? '').trim());
  const standingsGoalsCount = standingsRows.reduce((sum, row) => sum + Number(row.goals ?? 0), 0);
  const needsProviderBackfill =
    scorerFactsCount === 0 ||
    scorerFactsGoalsCount < confirmedGoalsCount ||
    scorerFactsGoalsCount > confirmedGoalsCount ||
    hasNameAnomaly;

  if (needsProviderBackfill) {
    const storedResultBackfill = await backfillTopScorersFromConfirmedResults(db, now.toISOString());
    if (storedResultBackfill.repaired) return storedResultBackfill;
  }

  if (scorerFactsCount > 0) {
    await rebuildTopScorerStandings(db, now.toISOString());
    return {
      repaired: true,
      reason: standingsCount === 0 || hasNameAnomaly || standingsGoalsCount !== visibleScorerFactsGoalsCount ? 'rebuilt-from-stored-scorers' : 'rebuilt-from-stored-scorers',
      repairedMatches: 0
    };
  }

  const matches = await repository.listTrackedMatches();
  const confirmedMatchIds = new Set(confirmedResults.map((result) => result.matchId));
  let repairedMatches = 0;
  for (const match of matches.filter((candidate) => confirmedMatchIds.has(candidate.id))) {
    const update = await provider.fetchMatchUpdate(match, now);
    if (update.scorers?.length) {
      await syncConfirmedScorersForMatch(db, match.id, update.scorers, now.toISOString());
      repairedMatches += 1;
    }
  }

  return {
    repaired: repairedMatches > 0,
    reason: repairedMatches > 0 ? 'backfilled-from-provider' : 'no-provider-scorers-found',
    repairedMatches
  };
}

export function getZeroedPublicLeaderboard(): LeaderboardEntry[] {
  return buildCanonicalPublicLeaderboardEntries();
}

export async function getLeaderboardScoringBreakdown(playerQuery: string, now = new Date()) {
  return buildLeaderboardScoringBreakdown({
    database: db,
    resultsRepository: repository,
    leaderboardRepository: repository,
    playerQuery,
    now
  });
}

export async function getPlayoffRepairStatus(input: {
  db?: typeof db;
  repository?: ResultsAgentRepository;
  provider?: ResultProvider;
  now?: Date;
} = {}): Promise<PlayoffRepairStatus> {
  const database = input.db ?? db;
  const resultsRepository = input.repository ?? repository;
  const resultProvider = input.provider ?? provider;
  const now = input.now ?? new Date();
  const latestRun = await database.one(`
    SELECT started_at, finished_at, checked_matches, finalized_matches, leaderboard_rebuilt, warnings_json
    FROM result_agent_runs
    ORDER BY finished_at DESC
    LIMIT 1
  `).catch(() => null);
  const match73 = await buildPlayoffRepairMatchStatus(database, resultsRepository, resultProvider, now, {
    snapshotRebuilt: Boolean(latestRun?.leaderboard_rebuilt),
    leaderboardRebuilt: Boolean(latestRun?.leaderboard_rebuilt)
  }).catch(() => undefined);
  return {
    lastRepairStartedAt: latestRun?.started_at ? String(latestRun.started_at) : undefined,
    lastRepairFinishedAt: latestRun?.finished_at ? String(latestRun.finished_at) : undefined,
    checked: Number(latestRun?.checked_matches ?? 0),
    repaired: Number(latestRun?.finalized_matches ?? 0),
    errors: parseWarnings(latestRun?.warnings_json),
    match73
  };
}

export async function listThirdPlaceQualifierLocksRuntime() {
  return {
    locks: await listThirdPlaceQualifierLocks(db)
  };
}

export async function upsertThirdPlaceQualifierLockRuntime(input: ThirdPlaceQualifierLockInput, now = new Date()) {
  const lock = await upsertThirdPlaceQualifierLock(db, input, now);
  const rebuild = await repository.refreshDerivedTournamentState?.(now.toISOString());
  return {
    lock,
    locks: await listThirdPlaceQualifierLocks(db),
    leaderboardRebuild: rebuild ? {
      recalculatedAt: rebuild.recalculatedAt,
      playersProcessed: rebuild.playersProcessed,
      matchesProcessed: rebuild.matchesProcessed,
      changedEntries: rebuild.changedEntries,
      warnings: rebuild.warnings
    } : undefined
  };
}

async function buildPlayoffRepairMatchStatus(
  database: typeof db,
  resultsRepository: ResultsAgentRepository,
  resultProvider: ResultProvider,
  now: Date,
  rebuildStatus: { snapshotRebuilt: boolean; leaderboardRebuilt: boolean }
): Promise<PlayoffRepairMatchStatus | undefined> {
  const trackedMatches = await resultsRepository.listTrackedMatches();
  const match = trackedMatches.find((candidate) => candidate.id === 73);
  if (!match) {
    return {
      matchNumber: 73,
      foundInTrackedMatches: false,
      persistedIsConfirmedFinal: false,
      includedInHealthConfirmed: false,
      includedInPlayedCount: false,
      includedInLatestResults: false,
      canadaInR16: false,
      snapshotRebuilt: rebuildStatus.snapshotRebuilt,
      leaderboardRebuilt: rebuildStatus.leaderboardRebuilt
    };
  }
  const stored = await resultsRepository.getMatchResult(73).catch(() => undefined);
  const providerUpdate = await resultProvider.fetchMatchUpdate(match, now).catch(() => undefined);
  const confirmedResultsCount = Number((await database.one(`
    SELECT COUNT(*) AS count
    FROM match_results
    WHERE ${CONFIRMED_FINAL_RESULT_SQL}
  `).catch(() => null))?.count ?? 0);
  const latestResultRows = await database.all(`
    SELECT m.id
    FROM match_results r
    JOIN matches m ON m.id = r.match_id
    WHERE ${CONFIRMED_FINAL_RESULT_SQL}
    ORDER BY COALESCE(r.confirmed_at, r.last_checked_at) DESC, m.id DESC
    LIMIT 8
  `).catch(() => []);
  const playoffState = await buildCanonicalPlayoffState({
    now,
    confirmedGroupStageMatches: confirmedResultsCount
  }).catch(() => undefined);
  const playoffFixture = playoffState?.bracketFixturesByMatchId.get(73);
  const canadaInR16 = Boolean(
    playoffFixture?.winnerTeamId &&
    (
      (playoffFixture.homeTeamId && playoffFixture.winnerTeamId === playoffFixture.homeTeamId && /(canada|kanada)/i.test(playoffFixture.homeTeam)) ||
      (playoffFixture.awayTeamId && playoffFixture.winnerTeamId === playoffFixture.awayTeamId && /(canada|kanada)/i.test(playoffFixture.awayTeam))
    )
  );
  const includedInLatestResults = latestResultRows.some((row) => Number(row.id) === 73);
  const persistedIsConfirmedFinal = Boolean(stored?.isFinal && stored.publicStatus === 'CONFIRMED_FINAL' || (stored?.confirmedHomeScore !== undefined && stored?.confirmedAwayScore !== undefined));
  return {
    matchNumber: 73,
    foundInTrackedMatches: true,
    providerFixtureId: Number(stored?.providerMatchId ?? match.providerMatchId ?? 73),
    providerStatus: providerUpdate?.rawProviderStatus ?? providerUpdate?.status ?? stored?.rawProviderStatus ?? stored?.status,
    providerScore: formatScore(providerUpdate?.homeScore ?? stored?.homeScore ?? stored?.confirmedHomeScore, providerUpdate?.awayScore ?? stored?.awayScore ?? stored?.confirmedAwayScore),
    persistedStatus: stored?.publicStatus ?? stored?.status,
    confirmedHomeScore: stored?.confirmedHomeScore ?? stored?.homeScore,
    confirmedAwayScore: stored?.confirmedAwayScore ?? stored?.awayScore,
    persistedIsConfirmedFinal,
    includedInHealthConfirmed: persistedIsConfirmedFinal,
    includedInPlayedCount: Boolean(stored?.confirmedHomeScore !== undefined && stored?.confirmedAwayScore !== undefined),
    includedInLatestResults,
    canadaInR16,
    snapshotRebuilt: rebuildStatus.snapshotRebuilt,
    leaderboardRebuilt: rebuildStatus.leaderboardRebuilt
  };
}

function formatScore(homeScore?: number, awayScore?: number): string | undefined {
  if (typeof homeScore !== 'number' || typeof awayScore !== 'number') return undefined;
  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) return undefined;
  return `${homeScore}-${awayScore}`;
}

function parseWarnings(value: unknown): string[] {
  if (typeof value !== 'string' || value.length === 0) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export async function deleteThirdPlaceQualifierLockRuntime(group: string, now = new Date()) {
  const existingLocks = await listThirdPlaceQualifierLocks(db);
  const removedLock = existingLocks.find((lock) => lock.group === group);
  await deleteThirdPlaceQualifierLockForGroup(db, group);
  const rebuild = await repository.refreshDerivedTournamentState?.(now.toISOString());
  return {
    removedLock,
    locks: await listThirdPlaceQualifierLocks(db),
    leaderboardRebuild: rebuild ? {
      recalculatedAt: rebuild.recalculatedAt,
      playersProcessed: rebuild.playersProcessed,
      matchesProcessed: rebuild.matchesProcessed,
      changedEntries: rebuild.changedEntries,
      warnings: rebuild.warnings
    } : undefined
  };
}
