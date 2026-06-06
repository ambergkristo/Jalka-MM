import { getResultAgentStatus, runResultUpdateCycle } from './resultAgent.js';
import { getManualResultPermission as resolveManualResultPermission, getResultAgentRunPermission as resolveResultAgentRunPermission } from './resultAgentSecurity.js';
import { loadResultProviderConfig } from './resultProviderConfig.js';
import { createResultProvider } from './resultProviderFactory.js';
import { db } from '../db.js';
import { predictionRepository } from '../../domain/predictionRepository.js';
import type { LeaderboardEntry, Player } from '../../domain/predictionRepository.js';
import { DatabaseResultRepository } from './databaseResultRepository.js';
import type { LeaderboardRepository } from './leaderboardRepository.js';
import { confirmManualResult, type ManualResultConfirmationInput } from './manualResultCorrection.js';

const repository = new DatabaseResultRepository(db);
const providerConfig = loadResultProviderConfig();
const provider = createResultProvider(providerConfig);

export function getResultsAgentStatus(now = new Date()) {
  return getResultAgentStatus({ repository, provider, now });
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
  if (persisted.length > 0) {
    const metadata = await leaderboardRepository.getLeaderboardMetadata();
    return {
      mode: 'persisted',
      recalculatedAt: metadata.lastRebuildAt,
      warnings: metadata.warnings,
      entries: persisted
    };
  }
  return {
    mode: 'pre-results',
    recalculatedAt: undefined,
    warnings: [],
    entries: getZeroedPublicLeaderboard()
  };
}

export function getZeroedPublicLeaderboard(): LeaderboardEntry[] {
  const playersById = new Map(predictionRepository.getPlayers().map((player) => [player.id, player]));
  const seeded = predictionRepository.getLeaderboard();
  const orderedPlayers = seeded.length > 0
    ? seeded.flatMap((entry) => playersById.get(entry.playerId) ?? [])
    : predictionRepository.getPlayers().sort(byName);
  return orderedPlayers.map((player, index) => ({
    playerId: player.id,
    rank: index + 1,
    points: 0,
    exactScores: 0,
    correctResults: 0,
    hitRate: 0,
    matchesScored: 0,
    matchPoints: 0,
    groupBonusPoints: 0,
    playoffBonusPoints: 0,
    topScorerBonusPoints: 0,
    totalPoints: 0,
    lastUpdatedAt: ''
  }));
}

function byName(a: Player, b: Player): number {
  return a.name.localeCompare(b.name, 'et');
}
