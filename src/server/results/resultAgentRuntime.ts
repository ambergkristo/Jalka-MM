import { getResultAgentStatus, runResultUpdateCycle } from './resultAgent.js';
import { getResultAgentRunPermission as resolveResultAgentRunPermission } from './resultAgentSecurity.js';
import { loadResultProviderConfig } from './resultProviderConfig.js';
import { createResultProvider } from './resultProviderFactory.js';
import { db } from '../db.js';
import { predictionRepository } from '../../domain/predictionRepository.js';
import type { LeaderboardEntry } from '../../domain/predictionRepository.js';
import { DatabaseResultRepository } from './databaseResultRepository.js';
import type { LeaderboardRepository } from './leaderboardRepository.js';

const repository = new DatabaseResultRepository(db);
const providerConfig = loadResultProviderConfig();
const provider = createResultProvider(providerConfig);

export function getResultsAgentStatus(now = new Date()) {
  return getResultAgentStatus({ repository, provider, now });
}

export function getResultsAgentRunPermission(input: { dryRunRequested?: boolean; providedSecret?: string }) {
  return resolveResultAgentRunPermission({ config: providerConfig, ...input });
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
  console.warn('Leaderboard API falling back to seed leaderboard because no persisted leaderboard rows exist yet.');
  return {
    mode: 'seed',
    recalculatedAt: undefined,
    warnings: [],
    entries: predictionRepository.getLeaderboard() satisfies LeaderboardEntry[]
  };
}
