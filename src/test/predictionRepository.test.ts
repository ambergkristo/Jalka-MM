import { describe, expect, it } from 'vitest';
import { JsonPredictionRepository, loadDefaultPredictionSeedData, validatePredictionSeedData, type PredictionSeedData } from '../domain/predictionRepository.js';

const validSeed: PredictionSeedData = {
  players: [{ id: 'argo', name: 'Argo' }],
  matchPredictions: [{ playerId: 'argo', matchId: 4, homeScore: 2, awayScore: 1 }],
  groupPredictions: Array.from({ length: 12 }, (_, index) => ({
    playerId: 'argo',
    group: String.fromCharCode(65 + index),
    first: 'Team A',
    second: 'Team B',
    third: 'Team C'
  })),
  knockoutPredictions: [{ playerId: 'argo', rounds: [{ round: 'R32', teams: ['Team A'] }] }],
  awardsPredictions: [{
    playerId: 'argo',
    championTeam: 'Brazil',
    championStatus: 'Still alive',
    topScorerName: 'Player A',
    topScorerTeam: 'Brazil',
    topScorerCurrentGoals: 3,
    topScorerStatus: 'In chase'
  }],
  leaderboard: [{ playerId: 'argo', rank: 1, points: 10, exactScores: 1, correctResults: 2, hitRate: 0.5, lastUpdatedAt: '2026-06-15T18:00:00.000Z' }]
};

describe('prediction seed validation', () => {
  it('accepts the committed prediction seed files', () => {
    const loadResult = loadDefaultPredictionSeedData();
    expect(loadResult.errors).toEqual([]);
    expect(loadResult.data.players).toHaveLength(10);
    expect(loadResult.data.matchPredictions).toHaveLength(10);
    expect(loadResult.data.leaderboard).toHaveLength(10);
  });

  it('detects duplicate player ids', () => {
    const errors = validatePredictionSeedData({
      ...validSeed,
      players: [{ id: 'argo', name: 'Argo' }, { id: 'argo', name: 'Argo Duplicate' }]
    });
    expect(errors).toContain('Duplicate player id: argo');
  });

  it('detects missing player references', () => {
    const errors = validatePredictionSeedData({
      ...validSeed,
      leaderboard: [{ ...validSeed.leaderboard[0], playerId: 'missing' }]
    });
    expect(errors).toContain('Leaderboard entry references missing player: missing');
  });

  it('detects incomplete group prediction sets', () => {
    const errors = validatePredictionSeedData({
      ...validSeed,
      groupPredictions: validSeed.groupPredictions.slice(0, 11)
    });
    expect(errors).toContain('Player argo has 11 group predictions; expected 12.');
  });

  it('detects invalid group ids', () => {
    const errors = validatePredictionSeedData({
      ...validSeed,
      groupPredictions: [{ ...validSeed.groupPredictions[0], group: 'Z' }]
    });
    expect(errors).toContain('Player argo has invalid group prediction: Z');
  });
});

describe('prediction repository', () => {
  it('returns leaderboard and player prediction bundles from seed data', () => {
    const repository = new JsonPredictionRepository(loadDefaultPredictionSeedData());
    expect(repository.getLeaderboard()[0]).toMatchObject({ playerId: 'argo', rank: 1 });
    const bundle = repository.getPlayerPredictionBundle('argo');
    expect(bundle?.player.name).toBe('Argo');
    expect(bundle?.matchPredictions).toHaveLength(1);
    expect(bundle?.groupPredictions).toHaveLength(12);
    expect(bundle?.awardsPrediction?.championTeam).toBe('Brazil');
  });

  it('returns undefined for missing player bundles instead of throwing', () => {
    const repository = new JsonPredictionRepository(loadDefaultPredictionSeedData());
    expect(repository.getPlayerPredictionBundle('missing-player')).toBeUndefined();
  });
});
