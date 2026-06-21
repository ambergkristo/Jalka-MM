import { EXPECTED_FULL_TIME_AFTER_KICKOFF_MS } from './matchScheduler.js';

export type PublicMatchState = 'live' | 'today' | 'upcoming' | 'finished' | 'stale';

export function classifyPublicMatchState(input: {
  kickoffAt: string;
  publicStatus?: string | null;
  isConfirmedFinal?: boolean;
  now: Date;
}): PublicMatchState {
  const kickoffMs = Date.parse(input.kickoffAt);
  if (Number.isNaN(kickoffMs)) return 'stale';
  if (input.isConfirmedFinal) return 'finished';

  const publicStatus = String(input.publicStatus ?? 'SCHEDULED').toUpperCase();
  if (publicStatus === 'LIVE' || publicStatus === 'CONFIRMING' || publicStatus === 'NEEDS_REVIEW') return 'live';

  const nowMs = input.now.getTime();
  const isTallinnToday = sameTallinnDate(input.kickoffAt, input.now);
  if (kickoffMs <= nowMs) {
    const elapsedSinceKickoff = nowMs - kickoffMs;
    if (elapsedSinceKickoff <= EXPECTED_FULL_TIME_AFTER_KICKOFF_MS) return 'live';
    return isTallinnToday ? 'today' : 'stale';
  }

  return isTallinnToday ? 'today' : 'upcoming';
}

export function sameTallinnDate(value: string, now: Date): boolean {
  const formatter = new Intl.DateTimeFormat('et-EE', {
    timeZone: 'Europe/Tallinn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date(value)) === formatter.format(now);
}
