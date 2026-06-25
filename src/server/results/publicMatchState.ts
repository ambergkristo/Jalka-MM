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
  if (publicStatus === 'LIVE') return 'live';
  if (publicStatus === 'CONFIRMING' || publicStatus === 'NEEDS_REVIEW' || publicStatus === 'CONFIRMED_FINAL') return 'stale';

  const nowMs = input.now.getTime();
  const isTallinnToday = sameTallinnDate(input.kickoffAt, input.now);
  if (isTallinnToday && kickoffMs > nowMs) return 'today';
  if (kickoffMs > nowMs) return 'upcoming';
  return 'stale';
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
