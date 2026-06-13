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
import { backfillTopScorersFromConfirmedResults, rebuildTopScorerStandings, syncConfirmedScorersForMatch } from './topScorerStandings.js';
import type { ResultUpdate } from './resultTypes.js';
import { leaderboardNeedsRepair, reconcileLeaderboardEntries } from './leaderboardProjection.js';

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
  const reconciled = await reconcileLeaderboardIfPossible(leaderboardRepository, persisted);
  const canonicalEntries = reconciled?.entries ?? buildCanonicalPublicLeaderboardEntries(persisted);
  const warnings = reconciled?.warnings ?? metadata.warnings;
  const recalculatedAt = reconciled?.recalculatedAt ?? metadata.lastRebuildAt;

  if (reconciled && leaderboardNeedsRepair(persisted, reconciled.entries)) {
    await leaderboardRepository.replaceLeaderboard(reconciled.entries, reconciled);
  }

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
  const standingsCount = Number((await db.one('SELECT COUNT(*) AS count FROM top_scorer_standings'))?.count ?? 0);
  if (standingsCount > 0) return { repaired: false, reason: 'already-populated', repairedMatches: 0 };

  const confirmedResults = await repository.getFinalizedResults();
  if (confirmedResults.length === 0) return { repaired: false, reason: 'no-confirmed-results', repairedMatches: 0 };

  const scorerFactsCount = Number((await db.one('SELECT COUNT(*) AS count FROM result_manual_scorers'))?.count ?? 0);
  if (scorerFactsCount > 0) {
    await rebuildTopScorerStandings(db, now.toISOString());
    return { repaired: true, reason: 'rebuilt-from-stored-scorers', repairedMatches: 0 };
  }

  const storedResultBackfill = await backfillTopScorersFromConfirmedResults(db, now.toISOString());
  if (storedResultBackfill.repaired) return storedResultBackfill;

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

async function reconcileLeaderboardIfPossible(
  leaderboardRepository: LeaderboardRepository,
  persisted: LeaderboardEntry[]
) {
  const source = leaderboardRepository as LeaderboardRepository & { getFinalizedResults?: () => Promise<ResultUpdate[]> };
  if (typeof source.getFinalizedResults !== 'function') return undefined;
  const finalizedResults = await source.getFinalizedResults();
  if (finalizedResults.length === 0) return undefined;
  return reconcileLeaderboardEntries({
    finalizedResults,
    now: new Date(),
    persistedEntries: persisted
  });
}
