import { describe, expect, it } from 'vitest';
import { applyLeaderboardRowToPlayerProfile, getLeaderboardRows, getPlayerProfile, getZeroedLeaderboardRows } from '../client/lib/predictionViewModels.js';
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

  it('keeps public player profile scoring zero before confirmed results exist', () => {
    const profile = getPlayerProfile('kristo-amberg');
    expect(profile).toMatchObject({
      points: 0,
      exactScores: 0,
      correctResults: 0,
      hitRate: '0%'
    });
  });

  it('applies public leaderboard stats to player profiles after confirmed recalculation', () => {
    const profile = getPlayerProfile('kristo-amberg');
    expect(profile).toBeDefined();
    const updated = applyLeaderboardRowToPlayerProfile(profile!, {
      rank: 4,
      playerId: 'kristo-amberg',
      player: 'Kristo Amberg',
      points: 18,
      exactScores: 2,
      correctResults: 5,
      hitRate: '71%',
      positionChange: 3
    });

    expect(updated).toMatchObject({
      rank: 4,
      points: 18,
      exactScores: 2,
      correctResults: 5,
      hitRate: '71%'
    });
  });

  it('includes imported match score predictions grouped by group in player profiles', () => {
    const profile = getPlayerProfile('kristo-amberg');
    const groupA = profile?.groupPredictions.find((group) => group.group === 'A');
    expect(groupA?.matchPredictions.length).toBeGreaterThan(0);
    expect(groupA?.matchPredictions.every((match) => typeof match.homeScore === 'number' && typeof match.awayScore === 'number')).toBe(true);
    expect(groupA?.matchPredictions[0]).toMatchObject({
      homeTeam: 'Mehhiko',
      homeTeamCode: 'MEX',
      awayTeam: 'Lõuna-Aafrika',
      awayTeamCode: 'RSA'
    });
  });

  it('does not expose private imported email data in player profile view models', () => {
    const profile = getPlayerProfile('kristo-amberg');
    expect(JSON.stringify(profile)).not.toContain('@');
  });

  it('resolves known top scorer prediction teams when import data has Unknown team', () => {
    expect(resolveScorerTeam('Kylian Mbappé', 'Unknown team')).toBe('Prantsusmaa');
    expect(resolveScorerTeam('Mbappe', 'Unknown team')).toBe('Prantsusmaa');
    expect(resolveScorerTeam('Harry Kane', 'Unknown team')).toBe('Inglismaa');
    expect(resolveScorerTeam('Haaland', 'Unknown team')).toBe('Norra');
    expect(resolveScorerTeam('Unknown Player', 'Unknown team')).toBe('Võistkond teadmata');
  });
});
