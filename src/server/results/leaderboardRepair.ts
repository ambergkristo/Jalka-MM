import type { LeaderboardEntry } from '../../domain/predictionRepository.js';
import type { ActualScoringState } from './scoringState.js';
import { leaderboardNeedsRepair, reconcileLeaderboardEntries } from './leaderboardProjection.js';
import type { LeaderboardRepository } from './leaderboardRepository.js';
import type { LeaderboardRebuildResult, ResultUpdate } from './resultTypes.js';

export async function repairPersistedLeaderboardSnapshot(input: {
  leaderboardRepository: LeaderboardRepository;
  persistedEntries: LeaderboardEntry[];
  finalizedResults: ResultUpdate[];
  now?: Date;
  actualScoringState?: ActualScoringState;
}): Promise<LeaderboardRebuildResult | undefined> {
  if (input.finalizedResults.length === 0) return undefined;

  const reconciled = await reconcileLeaderboardEntries({
    finalizedResults: input.finalizedResults,
    now: input.now ?? new Date(),
    persistedEntries: input.persistedEntries,
    ...input.actualScoringState
  });
  if (!reconciled) return undefined;

  if (leaderboardNeedsRepair(input.persistedEntries, reconciled.entries)) {
    await input.leaderboardRepository.replaceLeaderboard(reconciled.entries, reconciled);
    logLeaderboardRepair(reconciled, input.actualScoringState);
  }

  return reconciled;
}

function logLeaderboardRepair(rebuild: { playersProcessed: number; entries: LeaderboardEntry[] }, scoringState?: ActualScoringState): void {
  console.info('Leaderboard snapshot repaired', {
    playersRebuilt: rebuild.playersProcessed,
    bonusStateLoaded: Boolean(scoringState?.actualGroupStandings?.length || scoringState?.actualKnockoutResults || scoringState?.actualTopScorers?.length),
    nonZeroBonusCounts: {
      groupBonusPlayers: rebuild.entries.filter((entry) => (entry.groupBonusPoints ?? 0) > 0).length,
      playoffBonusPlayers: rebuild.entries.filter((entry) => (entry.playoffBonusPoints ?? 0) > 0).length,
      topScorerBonusPlayers: rebuild.entries.filter((entry) => (entry.topScorerBonusPoints ?? 0) > 0).length
    }
  });
}
