import { describe, expect, it } from 'vitest';
import { filterLeaderboardRows, normalizeLeaderboardSearchValue } from '../client/lib/leaderboardSearch.js';
import type { LeaderboardRowView } from '../client/lib/predictionViewModels.js';

const rows: LeaderboardRowView[] = [
  row({ playerId: 'kristo-amberg', player: 'Kristo Amberg', rank: 1 }),
  row({ playerId: 'priit-hynninen', player: 'Priit Hynninen', rank: 2 }),
  row({ playerId: 'joao-silva', player: 'João Silva', rank: 3 })
];

describe('leaderboard search', () => {
  it('normalizes accents, case, and punctuation', () => {
    expect(normalizeLeaderboardSearchValue('  João-SILVA  ')).toBe('joao silva');
  });

  it('filters leaderboard rows by player name', () => {
    expect(filterLeaderboardRows(rows, 'priit')).toEqual([rows[1]]);
    expect(filterLeaderboardRows(rows, 'kristo amb')).toEqual([rows[0]]);
  });

  it('also matches player slug fragments and keeps current rank values', () => {
    const result = filterLeaderboardRows(rows, 'hynninen');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ playerId: 'priit-hynninen', rank: 2 });
  });

  it('returns the original rows when query is empty', () => {
    expect(filterLeaderboardRows(rows, '   ')).toBe(rows);
  });
});

function row(input: Pick<LeaderboardRowView, 'playerId' | 'player' | 'rank'>): LeaderboardRowView {
  return {
    ...input,
    points: 0,
    exactScores: 0,
    correctResults: 0,
    hitRate: '0%',
    positionChange: 0
  };
}
