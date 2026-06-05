import { findNextSuggestedRunAt, planMatchUpdates } from './matchScheduler.js';
import { rebuildLeaderboardAfterFinalResult } from './leaderboardRebuild.js';
import type { LeaderboardRepository } from './leaderboardRepository.js';
import type { ResultProvider } from './resultProvider.js';
import type { ResultAgentRunSummary, ResultAgentStatus, ResultsAgentRepository } from './resultTypes.js';

export async function getResultAgentStatus(input: {
  repository: ResultsAgentRepository;
  provider: ResultProvider;
  now: Date;
}): Promise<ResultAgentStatus> {
  return input.repository.getStatus(input.provider.name, input.now);
}

export async function runResultUpdateCycle(input: {
  repository: ResultsAgentRepository;
  leaderboardRepository?: LeaderboardRepository;
  provider: ResultProvider;
  now: Date;
  dryRun?: boolean;
}): Promise<ResultAgentRunSummary> {
  const startedAt = input.now.toISOString();
  const matches = await input.repository.listTrackedMatches();
  const plans = planMatchUpdates(matches, input.now);
  const duePlans = plans.filter((plan) => plan.shouldCheckNow);
  let updatesApplied = 0;
  let finalizedResults = 0;
  const leaderboardRebuilds = [];
  const warnings: string[] = [];

  for (const plan of duePlans) {
    const match = matches.find((candidate) => candidate.id === plan.matchId);
    if (!match) continue;
    const update = await input.provider.fetchMatchUpdate(match, input.now);
    if (update.warning) warnings.push(update.warning);
    if (input.dryRun) continue;
    const { finalResultChanged } = await input.repository.saveResultUpdate({
      ...update,
      nextCheckAt: update.isFinal ? undefined : plan.nextCheckAt
    });
    updatesApplied += 1;
    if (finalResultChanged) {
      finalizedResults += 1;
      const finalized = await input.repository.getFinalizedResults();
      const previousEntries = await input.leaderboardRepository?.getLeaderboard();
      const rebuild = await rebuildLeaderboardAfterFinalResult({ finalizedResults: finalized, now: input.now, previousEntries });
      await input.leaderboardRepository?.replaceLeaderboard(rebuild.entries, rebuild);
      await input.repository.markPointsRecalculated(update.matchId, rebuild.recalculatedAt);
      leaderboardRebuilds.push(rebuild);
    }
  }

  const finishedAt = new Date(input.now.getTime() + 1).toISOString();
  const refreshedPlans = planMatchUpdates(await input.repository.listTrackedMatches(), input.now);
  const summary: ResultAgentRunSummary = {
    startedAt,
    finishedAt,
    checkedMatches: duePlans.length,
    updatesApplied,
    finalizedResults,
    dryRun: input.dryRun ?? false,
    updatedMatches: updatesApplied,
    finalizedMatches: finalizedResults,
    leaderboardRebuilt: leaderboardRebuilds.length > 0,
    playersProcessed: leaderboardRebuilds.at(-1)?.playersProcessed ?? 0,
    warnings: [...new Set([...(input.dryRun ? ['Dry run completed without persisting result, run summary, or leaderboard changes.'] : []), ...warnings, ...leaderboardRebuilds.flatMap((rebuild) => rebuild.warnings)])],
    leaderboardRebuilds,
    lastRunAt: finishedAt,
    nextSuggestedRunAt: findNextSuggestedRunAt(refreshedPlans),
    staleMatchesCount: refreshedPlans.filter((plan) => plan.shouldCheckNow).length,
    provider: input.provider.name,
    mode: input.provider.mode
  };
  if (!input.dryRun) await input.repository.saveRunSummary(summary);
  return summary;
}
