import { describe, expect, it } from 'vitest';
import { calculateRankMovement } from '../client/lib/leaderboardMovement.js';

describe('leaderboard movement', () => {
  it('shows upward movement when previous rank is worse than current rank', () => {
    expect(calculateRankMovement(10, 7)).toBe(3);
  });

  it('shows downward movement when previous rank is better than current rank', () => {
    expect(calculateRankMovement(7, 10)).toBe(-3);
  });

  it('shows neutral movement when ranks are unchanged', () => {
    expect(calculateRankMovement(10, 10)).toBe(0);
  });

  it('uses displayed tied ranks, not row index', () => {
    expect(calculateRankMovement(4, 4)).toBe(0);
  });

  it('handles lower-table movement the same way as top rows', () => {
    expect(calculateRankMovement(98, 103)).toBe(-5);
  });

  it('falls back to neutral when previous rank is missing', () => {
    expect(calculateRankMovement(undefined, 12)).toBe(0);
  });
});
