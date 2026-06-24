import { describe, expect, it } from 'vitest';
import { requirePenaltyWinnerForTiedKnockout, scoreGroupBonus, scoreKnockoutBonus, scoreMatch, scoreTopScorer } from '../domain/scoring.js';

describe('match scoring', () => {
  it('scores exact score', () => expect(scoreMatch({ matchId: 1, homeGoals: 2, awayGoals: 1 }, { matchId: 1, homeGoals: 2, awayGoals: 1 }).points).toBe(6));
  it('scores correct winner only', () => expect(scoreMatch({ matchId: 1, homeGoals: 1, awayGoals: 0 }, { matchId: 1, homeGoals: 3, awayGoals: 1 }).points).toBe(2));
  it('scores correct draw', () => expect(scoreMatch({ matchId: 1, homeGoals: 0, awayGoals: 0 }, { matchId: 1, homeGoals: 0, awayGoals: 0 }).points).toBe(6));
  it('scores correct draw with different score', () => expect(scoreMatch({ matchId: 1, homeGoals: 1, awayGoals: 1 }, { matchId: 1, homeGoals: 2, awayGoals: 2 }).points).toBe(4));
  it('scores correct goal difference', () => expect(scoreMatch({ matchId: 1, homeGoals: 2, awayGoals: 0 }, { matchId: 1, homeGoals: 3, awayGoals: 1 }).points).toBe(4));
  it('scores wrong prediction', () => expect(scoreMatch({ matchId: 1, homeGoals: 0, awayGoals: 1 }, { matchId: 1, homeGoals: 2, awayGoals: 0 }).points).toBe(0));
  it('requires penalty winner for tied knockout prediction', () => expect(() => requirePenaltyWinnerForTiedKnockout({ matchId: 73, homeGoals: 1, awayGoals: 1 })).toThrow('Penalty winner'));
});

describe('bonus scoring', () => {
  it('scores group bonus', () => {
    const points = scoreGroupBonus(
      { groupId: 'A', winnerTeamId: 'T01', secondTeamId: 'T02', qualifierTeamIds: ['T01', 'T03'] },
      { groupId: 'A', winnerTeamId: 'T01', secondTeamId: 'T03', qualifierTeamIds: ['T01', 'T02', 'T03'] }
    );
    expect(points.reduce((sum, item) => sum + item.points, 0)).toBe(16);
  });

  it('scores knockout round bonus', () => {
    const points = scoreKnockoutBonus(
      { r16TeamIds: ['T01'], qfTeamIds: ['T01'], sfTeamIds: ['T02'], finalTeamIds: ['T03'], thirdPlaceWinnerTeamId: 'T04', championTeamId: 'T05', topScorer: 'A' },
      { r16TeamIds: ['T01'], qfTeamIds: ['T01'], sfTeamIds: ['T09'], finalTeamIds: ['T03'], thirdPlaceWinnerTeamId: 'T08', championTeamId: 'T10', topScorer: 'B', topScorers: ['B'] }
    );
    expect(points.reduce((sum, item) => sum + item.points, 0)).toBe(65);
  });

  it('scores World Cup winner bonus', () => {
    const points = scoreKnockoutBonus(
      { r16TeamIds: [], qfTeamIds: [], sfTeamIds: [], finalTeamIds: [], thirdPlaceWinnerTeamId: 'T01', championTeamId: 'T02', topScorer: 'A' },
      { r16TeamIds: [], qfTeamIds: [], sfTeamIds: [], finalTeamIds: [], thirdPlaceWinnerTeamId: 'T03', championTeamId: 'T02', topScorer: 'B', topScorers: ['B'] }
    );
    expect(points.find((item) => item.code === 'winner')?.points).toBe(100);
  });

  it('awards the full top scorer bonus for tied official top scorers', () => expect(scoreTopScorer('Player A', ['Player A', 'Player B'])[0].points).toBe(50));
});

