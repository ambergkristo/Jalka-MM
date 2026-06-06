import { findNextSuggestedRunAt, planMatchUpdates } from './matchScheduler.js';
import { rebuildLeaderboardAfterFinalResult } from './leaderboardRebuild.js';
import type { LeaderboardRepository } from './leaderboardRepository.js';
import type { ResultProvider } from './resultProvider.js';
import { isResultProviderChain } from './providerChainResultProvider.js';
import { decideResultConsensus, toProviderResultObservation } from './resultConsensus.js';
import type { ResultAgentRunSummary, ResultAgentStatus, ResultUpdate, ResultsAgentRepository, TrackedMatch } from './resultTypes.js';

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
  confirmationDelayMinutes?: number;
}): Promise<ResultAgentRunSummary> {
  const startedAt = input.now.toISOString();
  const matches = await input.repository.listTrackedMatches();
  const plans = planMatchUpdates(matches, input.now);
  const duePlans = plans.filter((plan) => plan.shouldCheckNow);
  let updatesApplied = 0;
  let finalizedResults = 0;
  let confirmationPending = 0;
  let needsReview = 0;
  let observationsProcessed = 0;
  let wouldConfirm = 0;
  let wouldNeedsReview = 0;
  let finalObservations = 0;
  let provisionalObservations = 0;
  let liveObservations = 0;
  let scheduledObservations = 0;
  const leaderboardRebuilds = [];
  const warnings: string[] = [];
  const confirmationDelayMs = (input.confirmationDelayMinutes ?? 10) * 60_000;

  for (const plan of duePlans) {
    const match = matches.find((candidate) => candidate.id === plan.matchId);
    if (!match) continue;
    const updates = await fetchProviderUpdates(input.provider, match, input.now);
    observationsProcessed += updates.length;
    warnings.push(...updates.flatMap((update) => update.warning ? [update.warning] : []));
    const selectedUpdate = selectConsensusUpdate(updates);
    const previousResult = await input.repository.getMatchResult(selectedUpdate.matchId);
    const previousObservations = [
      ...await input.repository.getProviderResultObservations(selectedUpdate.matchId),
      ...updates.filter((update) => update !== selectedUpdate).map(toProviderResultObservation)
    ];
    const consensus = decideResultConsensus({
      observation: toProviderResultObservation(selectedUpdate),
      previousResult,
      previousObservations,
      now: input.now,
      confirmationDelayMs
    });
    warnings.push(...consensus.warnings);
    const publicStatus = consensus.update.publicStatus ?? (consensus.update.isFinal ? 'CONFIRMED_FINAL' : 'SCHEDULED');
    if (consensus.confirmed) wouldConfirm += 1;
    if (consensus.needsReview) wouldNeedsReview += 1;
    if (consensus.update.isFinal) finalObservations += 1;
    else if (publicStatus === 'CONFIRMING' || publicStatus === 'NEEDS_REVIEW') provisionalObservations += 1;
    else if (publicStatus === 'LIVE') liveObservations += 1;
    else scheduledObservations += 1;
    if (input.dryRun) continue;
    if (consensus.pending) confirmationPending += 1;
    if (consensus.needsReview) needsReview += 1;
    const { finalResultChanged } = await input.repository.saveResultUpdate({
      ...consensus.update,
      nextCheckAt: consensus.update.nextCheckAt ?? (consensus.update.isFinal ? undefined : plan.nextCheckAt)
    });
    updatesApplied += 1;
    if (finalResultChanged && consensus.confirmed) {
      finalizedResults += 1;
      const finalized = await input.repository.getFinalizedResults();
      const previousEntries = await input.leaderboardRepository?.getLeaderboard();
      const rebuild = await rebuildLeaderboardAfterFinalResult({ finalizedResults: finalized, now: input.now, previousEntries });
      await input.leaderboardRepository?.replaceLeaderboard(rebuild.entries, rebuild);
      await input.repository.markPointsRecalculated(consensus.update.matchId, rebuild.recalculatedAt);
      leaderboardRebuilds.push(rebuild);
    }
  }

  const finishedAt = new Date(input.now.getTime() + 1).toISOString();
  const refreshedPlans = planMatchUpdates(await input.repository.listTrackedMatches(), input.now);
  const summary: ResultAgentRunSummary = {
    startedAt,
    finishedAt,
    checkedMatches: duePlans.length,
    observationsProcessed,
    updatesApplied,
    finalizedResults,
    dryRun: input.dryRun ?? false,
    updatedMatches: updatesApplied,
    finalizedMatches: finalizedResults,
    wouldConfirm,
    wouldNeedsReview,
    finalObservations,
    provisionalObservations,
    liveObservations,
    scheduledObservations,
    confirmationPending,
    needsReview,
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

async function fetchProviderUpdates(provider: ResultProvider, match: TrackedMatch, now: Date): Promise<ResultUpdate[]> {
  if (isResultProviderChain(provider)) return provider.fetchMatchUpdates(match, now);
  return [await provider.fetchMatchUpdate(match, now)];
}

function selectConsensusUpdate(updates: ResultUpdate[]): ResultUpdate {
  const finalUpdate = [...updates].reverse().find((update) => update.isFinal);
  if (finalUpdate) return finalUpdate;
  return updates.find((update) => !update.warning) ?? updates[0];
}
