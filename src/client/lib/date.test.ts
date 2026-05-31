import { describe, expect, it } from 'vitest';
import { formatEstoniaKickoffTime, formatMatchDate } from './date.js';
import { formatCountdown, getDeadlineState } from './deadline.js';

describe('formatMatchDate', () => {
  it('returns a fallback for missing or invalid dates', () => {
    expect(formatMatchDate(undefined)).toBe('Kuupäev täpsustamisel');
    expect(formatMatchDate('not-a-date')).toBe('Kuupäev täpsustamisel');
  });

  it('formats valid ISO dates', () => {
    expect(formatMatchDate('2026-06-11T19:00:00.000Z')).not.toBe('Kuupäev täpsustamisel');
  });

  it('formats kickoff times in Estonia time', () => {
    expect(formatEstoniaKickoffTime('2026-06-11T19:00:00.000Z')).toBe('11. juuni · 22:00 Eesti aeg');
  });

  it('never renders Invalid Date for kickoff times', () => {
    expect(formatEstoniaKickoffTime('TBC')).toBe('Aeg täpsustamisel');
    expect(formatEstoniaKickoffTime('not-a-date')).toBe('Aeg täpsustamisel');
  });

  it('formats countdown state safely', () => {
    const open = getDeadlineState('2026-06-11T19:00:00.000Z', false, Date.parse('2026-06-10T19:00:00.000Z'));
    expect(open.status).toBe('open');
    expect(open.status === 'open' ? formatCountdown(open.remainingMs) : '').toBe('1 päeva 00:00:00');
    expect(getDeadlineState('not-a-date', false).status).toBe('missing');
    expect(getDeadlineState('2026-06-11T19:00:00.000Z', true).status).toBe('locked');
  });
});
