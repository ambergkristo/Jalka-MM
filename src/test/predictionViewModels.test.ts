import { describe, expect, it } from 'vitest';
import { applyLeaderboardRowToPlayerProfile, applyTopScorersToPlayerProfile, getLeaderboardRows, getPlayerProfile, getZeroedLeaderboardRows } from '../client/lib/predictionViewModels.js';
import { buildPublicTournamentState } from '../client/lib/publicTournamentState.js';
import { buildPlayoffBonusRows } from '../client/lib/playerPlayoffViewModels.js';
import { resolveScorerTeam } from '../client/lib/scorerTeamLookup.js';

describe('prediction view models', () => {
  it('exposes imported players for the public leaderboard', () => {
    const rows = getLeaderboardRows();
    expect(rows).toHaveLength(109);
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
    expect(rows).toHaveLength(109);
    expect(rows.every((row) => row.points === 0 && row.exactScores === 0 && row.correctResults === 0 && row.hitRate === '0%')).toBe(true);
  });

  it('builds imported player profiles and returns an empty state for missing players', () => {
    const profile = getPlayerProfile('kristo-amberg');
    expect(profile?.name).toBe('Kristo Amberg');
    expect(profile?.groupPredictions).toHaveLength(12);
    expect(profile?.knockoutPrediction.length).toBeGreaterThan(0);
    expect(profile?.playoffPrediction.r32Matches).toHaveLength(16);
    expect(profile?.playoffPrediction.r16Matches).toHaveLength(8);
    expect(profile?.playoffPrediction.quarterFinalMatches).toHaveLength(4);
    expect(profile?.playoffPrediction.semiFinalMatches).toHaveLength(2);
    expect(profile?.playoffPrediction.finalMatch?.matchId).toBe(103);
    expect(profile?.playoffPrediction.thirdPlaceMatch?.matchId).toBe(104);
    expect(profile?.playoffPrediction.championPick).not.toBe('Ennustus puudub');
    expect(profile?.playoffPrediction.topScorerPick).not.toBe('Ennustus puudub');
    expect(profile?.predictedChampion).not.toBe('Ennustus puudub');
    expect(profile?.topScorerPrediction.team).toBe('Prantsusmaa');
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

  it('uses public top scorer rows as the current goal source for player prediction cards', () => {
    const profile = getPlayerProfile('kristo-amberg');
    expect(profile?.topScorerPrediction.currentGoals).toBe(0);

    const updated = applyTopScorersToPlayerProfile(profile!, [
      { rank: 1, player: 'Lionel Messi', team: 'Argentina', goals: 3, assists: 0 },
      { rank: 2, player: 'K. Mbapp\u00e9', team: 'France', goals: 2, assists: 0 }
    ]);

    expect(updated.topScorerPrediction.currentGoals).toBe(2);
    expect(updated.topScorerPrediction.status).toBe('In chase');
  });

  it('keeps future playoff bonuses in Ootel status before knockout results exist', () => {
    const profile = getPlayerProfile('kristo-amberg');
    const state = buildPublicTournamentState(undefined, new Date('2026-06-12T12:00:00.000Z'));
    const rows = buildPlayoffBonusRows(profile!, state);

    expect(rows).toHaveLength(7);
    expect(rows.every((row) => row.status === 'Ootel' && row.points === 0)).toBe(true);
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
    expect(resolveScorerTeam('Kylian Mpabbe', 'Unknown team')).toBe('Prantsusmaa');
    expect(resolveScorerTeam('Lautaro Martinez', 'Unknown team')).toBe('Argentina');
    expect(resolveScorerTeam('Michael Olise', 'Unknown team')).toBe('Prantsusmaa');
    expect(resolveScorerTeam('Cody Gakpo', 'Unknown team')).toBe('Holland');
    expect(resolveScorerTeam('Pedri', 'Unknown team')).toBe('Hispaania');
    expect(resolveScorerTeam('Haaland , Norra', 'Unknown team')).toBe('Norra');
    expect(resolveScorerTeam('Prediction unavailable', 'Unknown team')).toBe('Võistkond teadmata');
    expect(resolveScorerTeam('TBD', 'TBC')).toBe('Võistkond teadmata');
    expect(resolveScorerTeam('Jude Bellingham', 'Unknown team')).toBe('Inglismaa');
    expect(resolveScorerTeam('Neymar', 'Unknown team')).toBe('Brasiilia');
    expect(resolveScorerTeam('Unknown Player', 'Unknown team')).toBe('Võistkond teadmata');
  });
});
