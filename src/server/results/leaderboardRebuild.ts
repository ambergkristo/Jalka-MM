import { rebuildLeaderboard } from '../../domain/pointsEngine.js';
import { predictionRepository } from '../../domain/predictionRepository.js';
import type { LeaderboardRebuildResult, ResultUpdate } from './resultTypes.js';

export async function rebuildLeaderboardAfterFinalResult(input: {
  finalizedResults: ResultUpdate[];
  now: Date;
}): Promise<LeaderboardRebuildResult> {
  const recalculatedAt = input.now.toISOString();
  const finalizedResults = input.finalizedResults.filter((result) => result.isFinal);
  const previousEntries = predictionRepository.getLeaderboard();
  const leaderboard = rebuildLeaderboard({
    players: predictionRepository.getPlayers(),
    predictions: predictionRepository.getMatchPredictions(),
    results: finalizedResults.flatMap((result) => {
      if (typeof result.homeScore !== 'number' || typeof result.awayScore !== 'number') return [];
      return [{
        matchId: result.matchId,
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        isFinal: result.isFinal
      }];
    }),
    previousEntries,
    recalculatedAt
  });
  const previousByPlayer = new Map(previousEntries.map((entry) => [entry.playerId, entry]));
  const changedEntries = leaderboard.entries.filter((entry) => {
    const previous = previousByPlayer.get(entry.playerId);
    return !previous || previous.rank !== entry.rank || previous.points !== entry.points || previous.exactScores !== entry.exactScores || previous.correctResults !== entry.correctResults;
  }).length;

  return {
    recalculatedAt,
    playersProcessed: leaderboard.entries.length,
    matchesProcessed: finalizedResults.length,
    changedEntries,
    entries: leaderboard.entries,
    warnings: leaderboard.warnings
  };
}
