import type { ProviderMatchMapEntry } from './providerMatchMap.js';
import { findProviderMatchMapEntry } from './providerMatchMap.js';
import { toResultUpdate, type ResultProvider } from './resultProvider.js';
import type { ProviderSpecificConfig } from './resultProviderConfig.js';
import type { ResultUpdate, TrackedMatch } from './resultTypes.js';

type FetchLike = (url: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json' | 'text'>>;

interface FootballDataMatchResponse {
  id?: number | string;
  status?: string;
  utcDate?: string;
  lastUpdated?: string;
  minute?: number | string;
  score?: {
    fullTime?: {
      home?: number | string | null;
      away?: number | string | null;
    };
    regularTime?: {
      home?: number | string | null;
      away?: number | string | null;
    };
  };
}

export class FootballDataResultProvider implements ResultProvider {
  readonly name = 'football-data-result-provider';
  readonly mode = 'live' as const;

  constructor(
    private readonly config: ProviderSpecificConfig,
    private readonly matchMap: ProviderMatchMapEntry[],
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  async fetchMatchUpdate(match: TrackedMatch, now: Date): Promise<ResultUpdate> {
    const mapEntry = findProviderMatchMapEntry({
      entries: this.matchMap,
      provider: 'football-data',
      internalMatchId: match.id,
      competitionId: this.config.competitionId,
      season: this.config.season
    });
    const providerFixtureId = mapEntry?.providerFixtureId ?? match.providerMatchId;
    if (!providerFixtureId) return missingFixtureUpdate(match, now, this.name);

    const fixture = await this.fetchFixture(String(providerFixtureId));
    const parsed = parseFootballDataMatch(fixture);
    return toResultUpdate({
      match,
      provider: this.name,
      providerMatchId: String(providerFixtureId),
      providerStatus: parsed.rawStatus,
      now,
      homeScore: parsed.homeScore,
      awayScore: parsed.awayScore,
      minute: parsed.minute,
      providerUpdatedAt: parsed.providerUpdatedAt,
      nextCheckAt: match.nextCheckAt
    });
  }

  private async fetchFixture(providerFixtureId: string): Promise<FootballDataMatchResponse> {
    if (!this.config.apiBaseUrl) throw new Error('FOOTBALL_DATA_API_BASE_URL is required for football-data.org result provider.');
    if (!this.config.apiKey) throw new Error('FOOTBALL_DATA_API_KEY is required for football-data.org result provider.');

    const url = new URL(`${trimTrailingSlash(this.config.apiBaseUrl)}/matches/${providerFixtureId}`);
    const response = await this.fetchImpl(url.toString(), {
      headers: {
        accept: 'application/json',
        'X-Auth-Token': this.config.apiKey
      }
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`football-data.org match request failed with HTTP ${response.status}${body ? `: ${body.slice(0, 160)}` : ''}`);
    }
    return (await response.json()) as FootballDataMatchResponse;
  }
}

export function parseFootballDataMatch(match: FootballDataMatchResponse): {
  rawStatus: string;
  homeScore?: number;
  awayScore?: number;
  minute?: number;
  providerUpdatedAt?: string;
} {
  return {
    rawStatus: footballDataStatusToProviderStatus(match.status ?? 'UNKNOWN'),
    ...extractFootballDataScore(match),
    minute: toNumber(match.minute),
    providerUpdatedAt: match.lastUpdated ?? match.utcDate
  };
}

export function footballDataStatusToProviderStatus(status: string): string {
  const normalized = status.trim().toUpperCase().replace(/[-\s]/g, '_');
  if (['SCHEDULED', 'TIMED'].includes(normalized)) return 'SCHEDULED';
  if (['IN_PLAY', 'LIVE'].includes(normalized)) return 'LIVE';
  if (['PAUSED', 'HALF_TIME', 'HT'].includes(normalized)) return 'HT';
  if (['FINISHED', 'FULL_TIME'].includes(normalized)) return 'FINISHED';
  if (['POSTPONED'].includes(normalized)) return 'POSTPONED';
  if (['SUSPENDED'].includes(normalized)) return 'SUSPENDED';
  return status;
}

function missingFixtureUpdate(match: TrackedMatch, now: Date, provider: string): ResultUpdate {
  return {
    matchId: match.id,
    providerMatchId: match.providerMatchId,
    status: match.status,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    minute: match.minute,
    isFinal: false,
    lastCheckedAt: now.toISOString(),
    nextCheckAt: match.nextCheckAt,
    provider,
    warning: `football-data.org fixture id is missing for internal match ${match.id}; provider call skipped.`
  };
}

function extractFootballDataScore(match: FootballDataMatchResponse): { homeScore?: number; awayScore?: number } {
  const fullTime = match.score?.fullTime;
  const regularTime = match.score?.regularTime;
  return {
    homeScore: toNumber(fullTime?.home) ?? toNumber(regularTime?.home),
    awayScore: toNumber(fullTime?.away) ?? toNumber(regularTime?.away)
  };
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}
