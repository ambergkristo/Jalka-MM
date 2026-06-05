import type { ResultUpdate, TrackedMatch } from './resultTypes.js';

export interface ResultProvider {
  name: string;
  mode: 'mock' | 'live';
  fetchMatchUpdate(match: TrackedMatch, now: Date): Promise<ResultUpdate>;
}

export interface ResultProviderChain {
  providers: ResultProvider[];
  fetchMatchUpdates(match: TrackedMatch, now: Date): Promise<ResultUpdate[]>;
}

export interface ProviderStatusNormalization {
  status: ResultUpdate['status'];
  isFinal: boolean;
  period?: ResultUpdate['period'];
  warning?: string;
}

export function normalizeProviderStatusDetail(status: string): ProviderStatusNormalization {
  const raw = status.trim();
  const normalized = raw.toUpperCase().replace(/[-\s]/g, '_');
  if (['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'].includes(normalized)) return { status: 'SCHEDULED', isFinal: false };
  if (['LIVE', 'IN_PLAY', 'FIRST_HALF', 'SECOND_HALF', '1H', '2H'].includes(normalized)) return { status: 'LIVE', isFinal: false, period: 'REGULAR' };
  if (['HT', 'HALF_TIME', 'HALFTIME', 'PAUSED'].includes(normalized)) return { status: 'HT', isFinal: false, period: 'REGULAR' };
  if (['ET', 'EXTRA_TIME'].includes(normalized)) return { status: 'ET', isFinal: false, period: 'EXTRA_TIME' };
  if (['PEN', 'PENALTIES', 'PENALTY_SHOOTOUT', 'PENALTY_IN_PROGRESS'].includes(normalized)) return { status: 'PEN', isFinal: false, period: 'PENALTIES' };
  if (['FT', 'FULL_TIME', 'FINISHED', 'AFTER_EXTRA_TIME', 'AET', 'AFTER_PENALTIES', 'PENALTIES_FINISHED'].includes(normalized)) {
    return { status: 'FINISHED', isFinal: true };
  }
  if (['POSTPONED', 'DELAYED'].includes(normalized)) return { status: 'POSTPONED', isFinal: false };
  if (['SUSPENDED', 'INTERRUPTED'].includes(normalized)) return { status: 'SUSPENDED', isFinal: false };
  return {
    status: 'SCHEDULED',
    isFinal: false,
    warning: `Unknown provider status "${raw}" normalized conservatively to SCHEDULED.`
  };
}

export function normalizeProviderStatus(status: string): ResultUpdate['status'] {
  return normalizeProviderStatusDetail(status).status;
}

export function toResultUpdate(input: {
  match: TrackedMatch;
  provider: string;
  providerStatus: string;
  now: Date;
  providerMatchId?: string;
  homeScore?: number;
  awayScore?: number;
  minute?: number;
  providerUpdatedAt?: string;
  nextCheckAt?: string;
}): ResultUpdate {
  const normalized = normalizeProviderStatusDetail(input.providerStatus);
  return {
    matchId: input.match.id,
    providerMatchId: input.providerMatchId ?? input.match.providerMatchId,
    status: normalized.status,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    minute: input.minute,
    period: normalized.period,
    isFinal: normalized.isFinal,
    lastCheckedAt: input.now.toISOString(),
    nextCheckAt: input.nextCheckAt,
    provider: input.provider,
    rawProviderStatus: input.providerStatus,
    providerUpdatedAt: input.providerUpdatedAt,
    warning: normalized.warning
  };
}
