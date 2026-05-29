import { describe, expect, it } from 'vitest';
import { calculateGroupStandings } from '../domain/standings.js';
import type { Match, MatchResult, Team } from '../domain/types.js';

describe('calculateGroupStandings', () => {
  it('calculates basic group table sorted by points, goal difference, goals for', () => {
    const teams: Team[] = ['A1', 'A2', 'A3', 'A4'].map((id) => ({ id, code: id, name: id, flag: '◇', groupId: 'A' }));
    const matches: Match[] = [
      { id: 1, stage: 'GROUP', groupId: 'A', kickoffAt: 'TBC', homeTeamId: 'A1', awayTeamId: 'A2', homeSlot: 'A1', awaySlot: 'A2' },
      { id: 2, stage: 'GROUP', groupId: 'A', kickoffAt: 'TBC', homeTeamId: 'A3', awayTeamId: 'A4', homeSlot: 'A3', awaySlot: 'A4' }
    ];
    const results: MatchResult[] = [
      { matchId: 1, homeGoals: 2, awayGoals: 0 },
      { matchId: 2, homeGoals: 1, awayGoals: 1 }
    ];
    const standings = calculateGroupStandings('A', teams, matches, results);
    expect(standings[0]).toMatchObject({ teamId: 'A1', played: 1, wins: 1, goalsFor: 2, goalsAgainst: 0, goalDifference: 2, points: 3 });
    expect(standings[1]).toMatchObject({ teamId: 'A3', draws: 1, points: 1 });
  });
});
