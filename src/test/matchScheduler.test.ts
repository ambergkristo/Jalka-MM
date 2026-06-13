import { describe, expect, it } from 'vitest';
import { planMatchUpdate } from '../server/results/matchScheduler.js';
import type { TrackedMatch } from '../server/results/resultTypes.js';

const now = new Date('2026-06-15T18:00:00.000Z');

function match(input: Partial<TrackedMatch>): TrackedMatch {
  return {
    id: input.id ?? 1,
    kickoffUtc: input.kickoffUtc ?? '2026-06-15T18:00:00.000Z',
    status: input.status ?? 'SCHEDULED',
    homeTeam: 'Home',
    awayTeam: 'Away',
    isFinal: input.isFinal ?? false,
    nextCheckAt: input.nextCheckAt
  };
}

describe('match scheduler polling rules', () => {
  it('waits until 30 minutes before kickoff for scheduled matches', () => {
    const plan = planMatchUpdate(match({ kickoffUtc: '2026-06-15T19:00:00.000Z' }), now);
    expect(plan.shouldCheckNow).toBe(false);
    expect(plan.reason).toBe('before-active-kickoff-window');
    expect(plan.nextCheckAt).toBe('2026-06-15T18:30:00.000Z');
  });

  it('checks scheduled matches inside the active kickoff window', () => {
    const plan = planMatchUpdate(match({ kickoffUtc: '2026-06-15T18:20:00.000Z' }), now);
    expect(plan.shouldCheckNow).toBe(true);
    expect(plan.reason).toBe('active-kickoff-window');
    expect(plan.nextCheckAt).toBe('2026-06-15T18:20:00.000Z');
  });

  it('checks kickoff-passed scheduled matches every two minutes before the full-time catch-up window', () => {
    const plan = planMatchUpdate(match({ kickoffUtc: '2026-06-15T17:55:00.000Z' }), now);
    expect(plan.shouldCheckNow).toBe(true);
    expect(plan.reason).toBe('active-kickoff-window');
    expect(plan.nextCheckAt).toBe('2026-06-15T18:02:00.000Z');
  });

  it('checks stale scheduled matches after expected full-time for Render catch-up', () => {
    const plan = planMatchUpdate(match({ kickoffUtc: '2026-06-15T16:15:00.000Z' }), now);
    expect(plan.shouldCheckNow).toBe(true);
    expect(plan.reason).toBe('stale-scheduled-after-expected-full-time');
    expect(plan.nextCheckAt).toBe('2026-06-15T18:01:00.000Z');
  });

  it('checks live and extra-time matches every two minutes', () => {
    expect(planMatchUpdate(match({ status: 'LIVE' }), now).nextCheckAt).toBe('2026-06-15T18:02:00.000Z');
    expect(planMatchUpdate(match({ status: 'ET' }), now).nextCheckAt).toBe('2026-06-15T18:02:00.000Z');
  });

  it('checks penalties every minute', () => {
    const plan = planMatchUpdate(match({ status: 'PEN' }), now);
    expect(plan.reason).toBe('penalties-one-minute-check');
    expect(plan.nextCheckAt).toBe('2026-06-15T18:01:00.000Z');
  });

  it('does not recheck locked final results', () => {
    const plan = planMatchUpdate(match({ status: 'FINISHED', isFinal: true }), now);
    expect(plan.shouldCheckNow).toBe(false);
    expect(plan.reason).toBe('final-result-locked');
  });
});
