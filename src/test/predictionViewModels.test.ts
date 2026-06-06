import { describe, expect, it } from 'vitest';
import { getLeaderboardRows, getPlayerProfile, getZeroedLeaderboardRows } from '../client/lib/predictionViewModels.js';
import { resolveScorerTeam } from '../client/lib/scorerTeamLookup.js';

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

  it('builds zeroed public leaderboard rows before confirmed results exist', () => {
    const rows = getZeroedLeaderboardRows();
    expect(rows).toHaveLength(24);
    expect(rows.every((row) => row.points === 0 && row.exactScores === 0 && row.correctResults === 0 && row.hitRate === '0%')).toBe(true);
  });

  it('builds imported player profiles and returns an empty state for missing players', () => {
    const profile = getPlayerProfile('kristo-amberg');
    expect(profile?.name).toBe('Kristo Amberg');
    expect(profile?.groupPredictions).toHaveLength(12);
    expect(profile?.knockoutPrediction.length).toBeGreaterThan(0);
    expect(profile?.predictedChampion).not.toBe('Ennustus puudub');
    expect(getPlayerProfile('missing-player')).toBeUndefined();
  });

  it('resolves known top scorer prediction teams when import data has Unknown team', () => {
    expect(resolveScorerTeam('Kylian Mbappé', 'Unknown team')).toBe('Prantsusmaa');
    expect(resolveScorerTeam('Mbappe', 'Unknown team')).toBe('Prantsusmaa');
    expect(resolveScorerTeam('Harry Kane', 'Unknown team')).toBe('Inglismaa');
    expect(resolveScorerTeam('Haaland', 'Unknown team')).toBe('Norra');
    expect(resolveScorerTeam('Unknown Player', 'Unknown team')).toBe('Võistkond teadmata');
  });
});
