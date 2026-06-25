import { describe, expect, it } from 'vitest';
import { classifyPublicMatchState } from '../server/results/publicMatchState.js';

describe('public match state classifier', () => {
  it('keeps already started scheduled matches out of the today list', () => {
    expect(classifyPublicMatchState({
      kickoffAt: '2026-06-21T19:00:00.000Z',
      publicStatus: 'SCHEDULED',
      now: new Date('2026-06-21T20:13:16.000Z')
    })).toBe('stale');
  });

  it('keeps stale scheduled 21.06 matches out of both live and today', () => {
    expect(classifyPublicMatchState({
      kickoffAt: '2026-06-21T16:00:00.000Z',
      publicStatus: 'SCHEDULED',
      now: new Date('2026-06-21T20:13:16.000Z')
    })).toBe('stale');
  });

  it('uses Europe/Tallinn dates for today grouping', () => {
    expect(classifyPublicMatchState({
      kickoffAt: '2026-06-20T23:30:00.000Z',
      publicStatus: 'SCHEDULED',
      now: new Date('2026-06-20T22:30:00.000Z')
    })).toBe('today');

    expect(classifyPublicMatchState({
      kickoffAt: '2026-06-21T21:30:00.000Z',
      publicStatus: 'SCHEDULED',
      now: new Date('2026-06-21T18:00:00.000Z')
    })).toBe('upcoming');
  });

  it('keeps provider-active and final matches in their explicit states', () => {
    expect(classifyPublicMatchState({
      kickoffAt: '2026-06-21T16:00:00.000Z',
      publicStatus: 'LIVE',
      now: new Date('2026-06-21T20:13:16.000Z')
    })).toBe('live');

    expect(classifyPublicMatchState({
      kickoffAt: '2026-06-21T16:00:00.000Z',
      publicStatus: 'CONFIRMED_FINAL',
      isConfirmedFinal: true,
      now: new Date('2026-06-21T20:13:16.000Z')
    })).toBe('finished');
  });

  it('keeps confirming final-score matches out of today matches', () => {
    expect(classifyPublicMatchState({
      kickoffAt: '2026-06-21T19:00:00.000Z',
      publicStatus: 'CONFIRMING',
      now: new Date('2026-06-21T20:13:16.000Z')
    })).toBe('stale');
  });
});
