import { describe, expect, it } from 'vitest';
import { getLeaderboardRows, getPlayerProfile } from '../client/lib/predictionViewModels.js';

describe('prediction view models', () => {
  it('exposes imported players for the public leaderboard', () => {
    const rows = getLeaderboardRows();
    expect(rows).toHaveLength(24);
    expect(rows.some((row) => row.playerId === 'kristo-amberg' && row.player === 'Kristo Amberg')).toBe(true);
    expect(rows[0]).toMatchObject({
      rank: 1,
      playerId: expect.any(String),
      player: expect.any(String),
      points: expect.any(Number)
    });
  });

  it('builds imported player profiles and returns an empty state for missing players', () => {
    const profile = getPlayerProfile('kristo-amberg');
    expect(profile?.name).toBe('Kristo Amberg');
    expect(profile?.groupPredictions).toHaveLength(12);
    expect(profile?.knockoutPrediction.length).toBeGreaterThan(0);
    expect(profile?.predictedChampion).not.toBe('Prediction unavailable');
    expect(getPlayerProfile('missing-player')).toBeUndefined();
  });
});
