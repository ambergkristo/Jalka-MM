import type { MatchUpdatePlan, MatchStatus, TrackedMatch } from './resultTypes.js';

const MINUTE = 60_000;
const ACTIVE_CHECK_WINDOW_MS = 30 * MINUTE;
const LIVE_CHECK_INTERVAL_MS = 5 * MINUTE;
const HALF_TIME_CHECK_INTERVAL_MS = 5 * MINUTE;
const PENALTY_CHECK_INTERVAL_MS = 2 * MINUTE;
const EXPECTED_FULL_TIME_AFTER_KICKOFF_MS = 110 * MINUTE;
const PASSIVE_RESCHEDULE_MS = 60 * MINUTE;

export function planMatchUpdate(match: TrackedMatch, now: Date): MatchUpdatePlan {
  if (match.isFinal || match.status === 'FINISHED') {
    return {
      matchId: match.id,
      shouldCheckNow: false,
      reason: 'final-result-locked'
    };
  }

  if (match.nextCheckAt && Date.parse(match.nextCheckAt) > now.getTime()) {
    return {
      matchId: match.id,
      shouldCheckNow: false,
      reason: 'next-check-in-future',
      nextCheckAt: match.nextCheckAt
    };
  }

  const kickoff = new Date(match.kickoffUtc);
  const activeWindowStartsAt = new Date(kickoff.getTime() - ACTIVE_CHECK_WINDOW_MS);
  const expectedFullTimeCheckAt = new Date(kickoff.getTime() + EXPECTED_FULL_TIME_AFTER_KICKOFF_MS);

  if (match.status === 'SCHEDULED' && now < activeWindowStartsAt) {
    return {
      matchId: match.id,
      shouldCheckNow: false,
      reason: 'before-active-kickoff-window',
      nextCheckAt: activeWindowStartsAt.toISOString()
    };
  }

  if (match.status === 'SCHEDULED' && now >= expectedFullTimeCheckAt) {
    return {
      matchId: match.id,
      shouldCheckNow: true,
      reason: 'stale-scheduled-after-expected-full-time',
      nextCheckAt: addMinutes(now, 5).toISOString()
    };
  }

  return {
    matchId: match.id,
    shouldCheckNow: true,
    reason: reasonForStatus(match.status),
    nextCheckAt: nextCheckAtForStatus(match.status, kickoff, now).toISOString()
  };
}

export function planMatchUpdates(matches: TrackedMatch[], now: Date): MatchUpdatePlan[] {
  return matches.map((match) => planMatchUpdate(match, now));
}

export function findNextSuggestedRunAt(plans: MatchUpdatePlan[]): string | undefined {
  return plans
    .map((plan) => plan.nextCheckAt)
    .filter((nextCheckAt): nextCheckAt is string => Boolean(nextCheckAt))
    .sort()[0];
}

export function isFinalStatus(status: MatchStatus): boolean {
  return status === 'FINISHED';
}

function reasonForStatus(status: MatchStatus): string {
  return ({
    SCHEDULED: 'active-kickoff-window',
    LIVE: 'live-match-five-minute-check',
    HT: 'half-time-check',
    ET: 'extra-time-five-minute-check',
    PEN: 'penalties-two-minute-check',
    FINISHED: 'final-result-locked',
    POSTPONED: 'postponed-recheck',
    SUSPENDED: 'suspended-recheck'
  } satisfies Record<MatchStatus, string>)[status];
}

function nextCheckAtForStatus(status: MatchStatus, kickoff: Date, now: Date): Date {
  if (status === 'PEN') return addMilliseconds(now, PENALTY_CHECK_INTERVAL_MS);
  if (status === 'LIVE' || status === 'ET') return addMilliseconds(now, LIVE_CHECK_INTERVAL_MS);
  if (status === 'HT') return addMilliseconds(now, HALF_TIME_CHECK_INTERVAL_MS);
  if (status === 'SCHEDULED') {
    const expectedFullTimeCheckAt = new Date(kickoff.getTime() + EXPECTED_FULL_TIME_AFTER_KICKOFF_MS);
    return now < kickoff ? kickoff : expectedFullTimeCheckAt;
  }
  return addMilliseconds(now, PASSIVE_RESCHEDULE_MS);
}

function addMinutes(date: Date, minutes: number): Date {
  return addMilliseconds(date, minutes * MINUTE);
}

function addMilliseconds(date: Date, milliseconds: number): Date {
  return new Date(date.getTime() + milliseconds);
}
