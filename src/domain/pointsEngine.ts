import type { LeaderboardEntry, Player, PlayerMatchPrediction } from './predictionRepository.js';

export interface MatchResultForScoring {
  matchId: number;
  homeScore: number;
  awayScore: number;
  isFinal: boolean;
}

export interface MatchPointsBreakdown {
  matchId: number;
  points: number;
  exactScore: boolean;
  correctResult: boolean;
}

export interface PlayerPointsResult {
  playerId: string;
  points: number;
  exactScores: number;
  correctResults: number;
  hitRate: number;
  matchesScored: number;
  breakdown: MatchPointsBreakdown[];
}

export interface RebuildLeaderboardResult {
  entries: LeaderboardEntry[];
  playerResults: PlayerPointsResult[];
  warnings: string[];
}

export function calculateMatchPredictionPoints(prediction: PlayerMatchPrediction, result: MatchResultForScoring): MatchPointsBreakdown {
  if (!result.isFinal) return { matchId: result.matchId, points: 0, exactScore: false, correctResult: false };
  const exactScore = prediction.homeScore === result.homeScore && prediction.awayScore === result.awayScore;
  const correctResult = outcome(prediction.homeScore, prediction.awayScore) === outcome(result.homeScore, result.awayScore);
  return {
    matchId: result.matchId,
    points: exactScore ? 3 : correctResult ? 1 : 0,
    exactScore,
    correctResult
  };
}

export function calculatePlayerPoints(playerId: string, predictions: PlayerMatchPrediction[], results: MatchResultForScoring[]): PlayerPointsResult {
  const resultByMatch = new Map(results.filter((result) => result.isFinal).map((result) => [result.matchId, result]));
  const breakdown = predictions
    .filter((prediction) => prediction.playerId === playerId)
    .flatMap((prediction) => {
      const result = resultByMatch.get(prediction.matchId);
      return result ? [calculateMatchPredictionPoints(prediction, result)] : [];
    });
  const matchesScored = breakdown.length;
  const correctResults = breakdown.filter((item) => item.correctResult).length;
  return {
    playerId,
    points: breakdown.reduce((sum, item) => sum + item.points, 0),
    exactScores: breakdown.filter((item) => item.exactScore).length,
    correctResults,
    hitRate: matchesScored === 0 ? 0 : correctResults / matchesScored,
    matchesScored,
    breakdown
  };
}

export function rebuildLeaderboard(input: {
  players: Player[];
  predictions: PlayerMatchPrediction[];
  results: MatchResultForScoring[];
  previousEntries?: LeaderboardEntry[];
  recalculatedAt: string;
}): RebuildLeaderboardResult {
  const warnings: string[] = [];
  if (input.results.filter((result) => result.isFinal).length === 0) warnings.push('No finalized match results available for leaderboard rebuild.');
  if (input.predictions.length === 0) warnings.push('No match prediction seed data available for leaderboard rebuild.');

  const previousRankByPlayer = new Map((input.previousEntries ?? []).map((entry) => [entry.playerId, entry.rank]));
  const playerResults = input.players.map((player) => calculatePlayerPoints(player.id, input.predictions, input.results));
  const rankedResults = [...playerResults].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores;
    if (b.correctResults !== a.correctResults) return b.correctResults - a.correctResults;
    return a.playerId.localeCompare(b.playerId);
  });

  const entries = rankedResults.map((result, index) => ({
    playerId: result.playerId,
    rank: index + 1,
    points: result.points,
    exactScores: result.exactScores,
    correctResults: result.correctResults,
    hitRate: result.hitRate,
    previousRank: previousRankByPlayer.get(result.playerId),
    lastUpdatedAt: input.recalculatedAt
  }));

  return { entries, playerResults, warnings };
}

function outcome(homeScore: number, awayScore: number): 'HOME' | 'DRAW' | 'AWAY' {
  if (homeScore > awayScore) return 'HOME';
  if (homeScore < awayScore) return 'AWAY';
  return 'DRAW';
}
