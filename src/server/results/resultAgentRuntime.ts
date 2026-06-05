import { InMemoryResultRepository } from './inMemoryResultRepository.js';
import { getResultAgentStatus, runResultUpdateCycle } from './resultAgent.js';
import { createResultProvider } from './resultProviderFactory.js';
import { predictionRepository } from '../../domain/predictionRepository.js';
import type { LeaderboardRebuildResult } from './resultTypes.js';

const repository = new InMemoryResultRepository();
const provider = createResultProvider();
let latestRebuild: LeaderboardRebuildResult | undefined;

export function getResultsAgentStatus(now = new Date()) {
  return getResultAgentStatus({ repository, provider, now });
}

export function runResultsAgentCycle(now = new Date()) {
  return runResultUpdateCycle({ repository, provider, now }).then((summary) => {
    latestRebuild = summary.leaderboardRebuilds.at(-1) ?? latestRebuild;
    return summary;
  });
}

export function getCurrentLeaderboard() {
  if (latestRebuild) {
    return {
      mode: 'in-memory-recalculated',
      recalculatedAt: latestRebuild.recalculatedAt,
      warnings: latestRebuild.warnings,
      entries: latestRebuild.entries
    };
  }
  return {
    mode: 'seed',
    recalculatedAt: undefined,
    warnings: ['Leaderboard is currently served from seed data until a result-agent rebuild runs.'],
    entries: predictionRepository.getLeaderboard()
  };
}
