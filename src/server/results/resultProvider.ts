import type { ResultUpdate, TrackedMatch } from './resultTypes.js';

export interface ResultProvider {
  name: string;
  fetchMatchUpdate(match: TrackedMatch, now: Date): Promise<ResultUpdate>;
}

export function normalizeProviderStatus(status: string): ResultUpdate['status'] {
  const normalized = status.trim().toUpperCase().replace(/[-\s]/g, '_');
  if (['SCHEDULED', 'TIMED', 'NOT_STARTED'].includes(normalized)) return 'SCHEDULED';
  if (['LIVE', 'IN_PLAY', 'FIRST_HALF', 'SECOND_HALF'].includes(normalized)) return 'LIVE';
  if (['HT', 'HALF_TIME', 'HALFTIME'].includes(normalized)) return 'HT';
  if (['ET', 'EXTRA_TIME'].includes(normalized)) return 'ET';
  if (['PEN', 'PENALTIES', 'PENALTY_SHOOTOUT'].includes(normalized)) return 'PEN';
  if (['FT', 'FULL_TIME', 'FINISHED', 'AFTER_PENALTIES'].includes(normalized)) return 'FINISHED';
  if (['POSTPONED', 'DELAYED'].includes(normalized)) return 'POSTPONED';
  if (['SUSPENDED', 'INTERRUPTED'].includes(normalized)) return 'SUSPENDED';
  return 'SCHEDULED';
}

export function toResultUpdate(input: {
  match: TrackedMatch;
  provider: string;
  providerStatus: string;
  now: Date;
  homeScore?: number;
  awayScore?: number;
  minute?: number;
  nextCheckAt?: string;
}): ResultUpdate {
  const status = normalizeProviderStatus(input.providerStatus);
  return {
    matchId: input.match.id,
    status,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    minute: input.minute,
    isFinal: status === 'FINISHED',
    lastCheckedAt: input.now.toISOString(),
    nextCheckAt: input.nextCheckAt,
    provider: input.provider,
    rawProviderStatus: input.providerStatus
  };
}
