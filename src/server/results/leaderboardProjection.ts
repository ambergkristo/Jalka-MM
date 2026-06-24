import type { LeaderboardEntry } from '../../domain/predictionRepository.js';
import { rebuildLeaderboardAfterFinalResult } from './leaderboardRebuild.js';
import type { ActualGroupStanding, ActualKnockoutResults, ActualTopScorer } from '../../domain/pointsEngine.js';
import type { LeaderboardRebuildResult, ResultUpdate } from './resultTypes.js';

export async function reconcileLeaderboardEntries(input: {
  persistedEntries: LeaderboardEntry[];
  finalizedResults: ResultUpdate[];
  now?: Date;
  actualGroupStandings?: ActualGroupStanding[];
  actualKnockoutResults?: ActualKnockoutResults;
  actualTopScorers?: ActualTopScorer[];
}): Promise<LeaderboardRebuildResult | undefined> {
  if (input.finalizedResults.length === 0) return undefined;
  return rebuildLeaderboardAfterFinalResult({
    finalizedResults: input.finalizedResults,
    now: input.now ?? new Date(),
    previousEntries: input.persistedEntries,
    actualGroupStandings: input.actualGroupStandings,
    actualKnockoutResults: input.actualKnockoutResults,
    actualTopScorers: input.actualTopScorers
  });
}

export function leaderboardNeedsRepair(existing: LeaderboardEntry[], rebuilt: LeaderboardEntry[]): boolean {
  if (existing.length !== rebuilt.length) return true;
  const existingByPlayer = new Map(existing.map((entry) => [entry.playerId, entry]));
  return rebuilt.some((entry) => {
    const current = existingByPlayer.get(entry.playerId);
    if (!current) return true;
    return (
      current.rank !== entry.rank ||
      current.points !== entry.points ||
      current.exactScores !== entry.exactScores ||
      current.correctResults !== entry.correctResults ||
      current.hitRate !== entry.hitRate ||
      current.matchesScored !== entry.matchesScored ||
      current.matchPoints !== entry.matchPoints ||
      current.groupBonusPoints !== entry.groupBonusPoints ||
      current.playoffBonusPoints !== entry.playoffBonusPoints ||
      current.topScorerBonusPoints !== entry.topScorerBonusPoints ||
      current.totalPoints !== entry.totalPoints
    );
  });
}
