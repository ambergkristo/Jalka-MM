import { describe, expect, it } from 'vitest';
import { calculateMatchPredictionPoints, calculatePlayerPoints, rebuildLeaderboard, type MatchResultForScoring } from '../domain/pointsEngine.js';
import type { Player, PlayerMatchPrediction } from '../domain/predictionRepository.js';

const finalHomeWin: MatchResultForScoring = { matchId: 1, homeScore: 2, awayScore: 1, isFinal: true };

describe('MVP match prediction scoring', () => {
  it('scores exact score as 3 points', () => {
    expect(calculateMatchPredictionPoints({ playerId: 'p1', matchId: 1, homeScore: 2, awayScore: 1 }, finalHomeWin)).toMatchObject({
      points: 3,
      exactScore: true,
      correctResult: true
    });
  });

  it('scores correct home-win outcome as 1 point', () => {
    expect(calculateMatchPredictionPoints({ playerId: 'p1', matchId: 1, homeScore: 1, awayScore: 0 }, finalHomeWin).points).toBe(1);
  });

  it('scores correct draw outcome as 1 point', () => {
    const result = { matchId: 2, homeScore: 1, awayScore: 1, isFinal: true };
    expect(calculateMatchPredictionPoints({ playerId: 'p1', matchId: 2, homeScore: 2, awayScore: 2 }, result).points).toBe(1);
  });

  it('scores incorrect result as 0 points', () => {
    expect(calculateMatchPredictionPoints({ playerId: 'p1', matchId: 1, homeScore: 0, awayScore: 1 }, finalHomeWin).points).toBe(0);
  });
});

describe('player totals and leaderboard rebuild', () => {
  const players: Player[] = [{ id: 'argo', name: 'Argo' }, { id: 'kristo', name: 'Kristo' }, { id: 'martin', name: 'Martin' }];
  const predictions: PlayerMatchPrediction[] = [
    { playerId: 'argo', matchId: 1, homeScore: 2, awayScore: 1 },
    { playerId: 'argo', matchId: 2, homeScore: 1, awayScore: 1 },
    { playerId: 'kristo', matchId: 1, homeScore: 1, awayScore: 0 },
    { playerId: 'kristo', matchId: 2, homeScore: 2, awayScore: 2 },
    { playerId: 'martin', matchId: 1, homeScore: 0, awayScore: 1 },
    { playerId: 'martin', matchId: 2, homeScore: 2, awayScore: 1 }
  ];
  const results: MatchResultForScoring[] = [
    { matchId: 1, homeScore: 2, awayScore: 1, isFinal: true },
    { matchId: 2, homeScore: 0, awayScore: 0, isFinal: true }
  ];

  it('calculates player total points and hit rate', () => {
    const argo = calculatePlayerPoints('argo', predictions, results);
    expect(argo.points).toBe(4);
    expect(argo.exactScores).toBe(1);
    expect(argo.correctResults).toBe(2);
    expect(argo.hitRate).toBe(1);
    expect(argo.matchesScored).toBe(2);
  });

  it('orders leaderboard by points, exact scores, correct results, then player id', () => {
    const leaderboard = rebuildLeaderboard({ players, predictions, results, recalculatedAt: '2026-06-15T18:00:00.000Z' });
    expect(leaderboard.entries.map((entry) => `${entry.rank}:${entry.playerId}:${entry.points}`)).toEqual([
      '1:argo:4',
      '2:kristo:2',
      '3:martin:0'
    ]);
  });
});
