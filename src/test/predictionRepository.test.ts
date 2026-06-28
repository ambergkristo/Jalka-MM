import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { JsonPredictionRepository, loadDefaultPredictionSeedData, validatePredictionSeedData, type PredictionSeedData } from '../domain/predictionRepository.js';
import { generateUniquePlayerId, slugifyPlayerId } from '../domain/playerIds.js';

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
    expect(loadResult.data.players).toHaveLength(109);
    expect(loadResult.data.matchPredictions).toHaveLength(11336);
    expect(loadResult.data.leaderboard).toHaveLength(109);
    expect(loadResult.data.players.map((player) => player.id)).toContain('kristo-amberg');
    expect(loadResult.data.players.every((player) => typeof player.location === 'string' && player.location.length > 0)).toBe(true);
    expect(loadResult.data.players.map((player) => player.location)).toContain('Saaremaa');
  });

  it('does not expose email addresses in public player seeds', () => {
    const publicPlayers = readFileSync('src/data/players.json', 'utf8');
    expect(publicPlayers).not.toMatch(/@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
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
    expect(repository.getLeaderboard()).toHaveLength(109);
    const bundle = repository.getPlayerPredictionBundle('kristo-amberg');
    expect(bundle?.player.name).toBe('Kristo Amberg');
    expect(bundle?.matchPredictions).toHaveLength(104);
    expect(bundle?.groupPredictions).toHaveLength(12);
    expect(bundle?.awardsPrediction?.championTeam).toBeTruthy();
    expect(bundle?.knockoutPrediction?.thirdPlaceWinner).toBeTruthy();
  });

  it('returns undefined for missing player bundles instead of throwing', () => {
    const repository = new JsonPredictionRepository(loadDefaultPredictionSeedData());
    expect(repository.getPlayerPredictionBundle('missing-player')).toBeUndefined();
  });
});

describe('player id generation', () => {
  it('normalizes names into stable public ids', () => {
    expect(slugifyPlayerId('Kristo Amberg')).toBe('kristo-amberg');
    expect(slugifyPlayerId('Vallo P\u00f5ldma')).toBe('vallo-poldma');
    expect(slugifyPlayerId('Karl-Erik Kotsar')).toBe('karl-erik-kotsar');
  });

  it('deduplicates repeated player names with numeric suffixes', () => {
    const used = new Set<string>();
    expect(generateUniquePlayerId('Kristo Amberg', used)).toBe('kristo-amberg');
    expect(generateUniquePlayerId('Kristo Amberg', used)).toBe('kristo-amberg-2');
  });
});
