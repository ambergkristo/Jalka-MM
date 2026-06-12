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
import type { ResultUpdate } from './resultTypes.js';
import { leaderboardNeedsRepair, reconcileLeaderboardEntries } from './leaderboardProjection.js';

const repository = new DatabaseResultRepository(db);
const providerConfig = loadResultProviderConfig();
const provider = createResultProvider(providerConfig);

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
