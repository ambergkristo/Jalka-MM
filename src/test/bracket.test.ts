import { describe, expect, it } from 'vitest';
import { formatBracketSlot, resolveBracketSlot } from '../domain/bracket.js';

describe('bracket slots', () => {
  it('formats unresolved bracket slots clearly', () => {
    expect(formatBracketSlot({ type: 'group-winner', groupId: 'A' })).toBe('Winner Group A');
    expect(formatBracketSlot({ type: 'previous-match-winner', matchId: 73 })).toBe('Winner Match 73');
    expect(formatBracketSlot({ type: 'best-third-place' })).toBe('Best 3rd-place team');
  });

  it('resolves known group winner and leaves missing slots unresolved', () => {
    expect(resolveBracketSlot({ type: 'group-winner', groupId: 'A' }, { groupStandings: { A: [{ teamId: 'A1', rank: 1 }] } })).toEqual({ teamId: 'A1', label: 'A1', unresolved: false });
    expect(resolveBracketSlot({ type: 'previous-match-winner', matchId: 73 })).toEqual({ label: 'Winner Match 73', unresolved: true });
  });
});
