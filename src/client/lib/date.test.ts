import { describe, expect, it } from 'vitest';
import { formatMatchDate } from './date.js';

describe('formatMatchDate', () => {
  it('returns a fallback for missing or invalid dates', () => {
    expect(formatMatchDate(undefined)).toBe('Date TBC');
    expect(formatMatchDate('not-a-date')).toBe('Date TBC');
  });

  it('formats valid ISO dates', () => {
    expect(formatMatchDate('2026-06-11T19:00:00.000Z')).not.toBe('Date TBC');
  });
});
