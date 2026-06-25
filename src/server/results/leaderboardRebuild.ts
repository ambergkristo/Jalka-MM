import { rebuildLeaderboard } from '../../domain/pointsEngine.js';
import { predictionRepository } from '../../domain/predictionRepository.js';
import type { ActualGroupStanding, ActualKnockoutResults, ActualTopScorer } from '../../domain/pointsEngine.js';
import type { LeaderboardRebuildResult, ResultUpdate } from './resultTypes.js';
import { toScoringMatchResult } from './leaderboardScoring.js';

export async function rebuildLeaderboardAfterFinalResult(input: {
  finalizedResults: ResultUpdate[];
  now: Date;
  previousEntries?: ReturnType<typeof predictionRepository.getLeaderboard>;
  actualGroupStandings?: ActualGroupStanding[];
  actualKnockoutResults?: ActualKnockoutResults;
  actualTopScorers?: ActualTopScorer[];
}): Promise<LeaderboardRebuildResult> {
  const recalculatedAt = input.now.toISOString();
  const finalizedResults = input.finalizedResults.filter((result) => result.isFinal);
  const previousEntries = input.previousEntries ?? predictionRepository.getLeaderboard();
  const leaderboard = rebuildLeaderboard({
    players: predictionRepository.getPlayers(),
    predictions: predictionRepository.getMatchPredictions(),
    groupPredictions: predictionRepository.getGroupPredictions(),
    knockoutPredictions: predictionRepository.getKnockoutPredictions(),
    awardsPredictions: predictionRepository.getAwardsPredictions(),
    results: finalizedResults.flatMap((result) => {
      const scoringResult = toScoringMatchResult(result);
      return scoringResult ? [scoringResult] : [];
    }),
    actualGroupStandings: input.actualGroupStandings,
    actualKnockoutResults: input.actualKnockoutResults,
    actualTopScorers: input.actualTopScorers,
    previousEntries,
    recalculatedAt
  });
  const movementBaselineResults = selectMovementBaselineResults(finalizedResults);
  const previousRanks = movementBaselineResults.length > 0 && movementBaselineResults.length < finalizedResults.length
    ? new Map(
      rebuildLeaderboard({
        players: predictionRepository.getPlayers(),
        predictions: predictionRepository.getMatchPredictions(),
        groupPredictions: predictionRepository.getGroupPredictions(),
        knockoutPredictions: predictionRepository.getKnockoutPredictions(),
        awardsPredictions: predictionRepository.getAwardsPredictions(),
        results: movementBaselineResults.flatMap((result) => {
          const scoringResult = toScoringMatchResult(result);
          return scoringResult ? [scoringResult] : [];
        }),
        previousEntries,
        recalculatedAt,
        actualGroupStandings: input.actualGroupStandings,
        actualKnockoutResults: input.actualKnockoutResults,
        actualTopScorers: input.actualTopScorers
      }).entries.map((entry) => [entry.playerId, entry.rank])
    )
    : new Map(previousEntries.map((entry) => [entry.playerId, entry.rank]));
  const entries = leaderboard.entries.map((entry) => ({
    ...entry,
    previousRank: previousRanks.get(entry.playerId)
  }));
  logLeaderboardRebuildSummary({
    playersProcessed: entries.length,
    actualGroupStandings: input.actualGroupStandings,
    actualKnockoutResults: input.actualKnockoutResults,
    actualTopScorers: input.actualTopScorers,
    entries
  });
  const previousByPlayer = new Map(previousEntries.map((entry) => [entry.playerId, entry]));
  const changedEntries = entries.filter((entry) => {
    const previous = previousByPlayer.get(entry.playerId);
    return !previous || previous.rank !== entry.rank || previous.points !== entry.points || previous.exactScores !== entry.exactScores || previous.correctResults !== entry.correctResults;
  }).length;

  return {
    recalculatedAt,
    playersProcessed: entries.length,
    matchesProcessed: finalizedResults.length,
    changedEntries,
    entries,
    warnings: leaderboard.warnings
  };
}

function logLeaderboardRebuildSummary(input: {
  playersProcessed: number;
  actualGroupStandings?: ActualGroupStanding[];
  actualKnockoutResults?: ActualKnockoutResults;
  actualTopScorers?: ActualTopScorer[];
  entries: Array<{
    groupBonusPoints?: number;
    playoffBonusPoints?: number;
    topScorerBonusPoints?: number;
  }>;
}): void {
  const bonusStateLoaded = Boolean(input.actualGroupStandings?.length || input.actualKnockoutResults || input.actualTopScorers?.length);
  const bonusCounts = {
    groupBonusPlayers: input.entries.filter((entry) => (entry.groupBonusPoints ?? 0) > 0).length,
    playoffBonusPlayers: input.entries.filter((entry) => (entry.playoffBonusPoints ?? 0) > 0).length,
    topScorerBonusPlayers: input.entries.filter((entry) => (entry.topScorerBonusPoints ?? 0) > 0).length
  };
  console.info('Leaderboard rebuilt', {
    playersProcessed: input.playersProcessed,
    bonusStateLoaded,
    bonusCounts
  });
}

function selectMovementBaselineResults(finalizedResults: ResultUpdate[]): ResultUpdate[] {
  const timestamps = finalizedResults
    .map((result) => result.confirmedAt ?? result.lastCheckedAt)
    .filter((timestamp): timestamp is string => typeof timestamp === 'string' && !Number.isNaN(Date.parse(timestamp)));
  if (timestamps.length === 0) return [];

  const latestTimestamp = Math.max(...timestamps.map((timestamp) => Date.parse(timestamp)));
  return finalizedResults.filter((result) => {
    const timestamp = result.confirmedAt ?? result.lastCheckedAt;
    return typeof timestamp === 'string' && Date.parse(timestamp) < latestTimestamp;
  });
}
