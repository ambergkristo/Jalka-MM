import { describe, expect, it } from 'vitest';
import { formatEstoniaKickoffTime, formatMatchDate } from './date.js';

describe('formatMatchDate', () => {
  it('returns a fallback for missing or invalid dates', () => {
    expect(formatMatchDate(undefined)).toBe('Date TBC');
    expect(formatMatchDate('not-a-date')).toBe('Date TBC');
  });

  it('formats valid ISO dates', () => {
    expect(formatMatchDate('2026-06-11T19:00:00.000Z')).not.toBe('Date TBC');
  });

  it('formats kickoff times in Estonia time', () => {
    expect(formatEstoniaKickoffTime('2026-06-11T19:00:00.000Z')).toBe('22:00 Eesti aeg');
  });

  it('never renders Invalid Date for kickoff times', () => {
    expect(formatEstoniaKickoffTime('TBC')).toBe('Time TBC');
    expect(formatEstoniaKickoffTime('not-a-date')).toBe('Time TBC');
  });
});
