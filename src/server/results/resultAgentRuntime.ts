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
import type { ResultUpdate } from './resultTypes.js';
import { normalizeScorerName } from './scorerNormalization.js';
import { CONFIRMED_FINAL_RESULT_SQL } from './finalizedResultState.js';
import { buildConfiguredActualScoringState } from './scoringState.js';
import { repairPersistedLeaderboardSnapshot as repairPersistedLeaderboardSnapshotImpl } from './leaderboardRepair.js';
import { buildLeaderboardScoringBreakdown } from './leaderboardScoring.js';
import { listThirdPlaceQualifierLocks, upsertThirdPlaceQualifierLock, type ThirdPlaceQualifierLockInput } from './thirdPlaceQualifierLocks.js';

const repository = new DatabaseResultRepository(db);
const providerConfig = loadResultProviderConfig();
const provider = createResultProvider(providerConfig);
let catchUpInFlight: Promise<void> | undefined;

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

export function queueResultAgentCatchUp(now = new Date()): Promise<void> | undefined {
  if (providerConfig.writeMode !== 'live') return undefined;
  if (catchUpInFlight) return catchUpInFlight;

  catchUpInFlight = (async () => {
    const status = await repository.getStatus(provider.name, now);
    if (status.staleMatchesCount === 0) return;
    await runResultsAgentCycle(now);
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
