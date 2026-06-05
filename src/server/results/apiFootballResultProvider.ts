import type { ProviderMatchMapEntry } from './providerMatchMap.js';
import { findProviderMatchMapEntry } from './providerMatchMap.js';
import { toResultUpdate, type ResultProvider } from './resultProvider.js';
import type { ProviderSpecificConfig } from './resultProviderConfig.js';
import type { ResultUpdate, TrackedMatch } from './resultTypes.js';

type FetchLike = (url: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json' | 'text'>>;

interface ApiFootballFixtureResponse {
  response?: ApiFootballFixture[];
}

interface ApiFootballStatus {
  short?: string;
  long?: string;
  elapsed?: number | string;
}

interface ApiFootballFixture {
  fixture?: {
    id?: number | string;
    date?: string;
    status?: ApiFootballStatus;
  };
  goals?: {
    home?: number | string | null;
    away?: number | string | null;
  };
  score?: {
    fulltime?: {
      home?: number | string | null;
      away?: number | string | null;
    };
  };
}

export class ApiFootballResultProvider implements ResultProvider {
  readonly name = 'api-football-result-provider';
  readonly mode = 'live' as const;

  constructor(
    private readonly config: ProviderSpecificConfig,
    private readonly matchMap: ProviderMatchMapEntry[],
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  async fetchMatchUpdate(match: TrackedMatch, now: Date): Promise<ResultUpdate> {
    const mapEntry = findProviderMatchMapEntry({
      entries: this.matchMap,
      provider: 'api-football',
      internalMatchId: match.id,
      competitionId: this.config.competitionId,
      season: this.config.season
    });
    const providerFixtureId = mapEntry?.providerFixtureId ?? match.providerMatchId;
    if (!providerFixtureId) return missingFixtureUpdate(match, now, this.name);

    const fixture = await this.fetchFixture(String(providerFixtureId));
    const parsed = parseApiFootballFixture(fixture);
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

  private async fetchFixture(providerFixtureId: string): Promise<ApiFootballFixture> {
    if (!this.config.apiBaseUrl) throw new Error('API_FOOTBALL_API_BASE_URL is required for API-Football result provider.');
    if (!this.config.apiKey) throw new Error('API_FOOTBALL_API_KEY is required for API-Football result provider.');

    const url = new URL(`${trimTrailingSlash(this.config.apiBaseUrl)}/fixtures`);
    url.searchParams.set('id', providerFixtureId);

    const headers: Record<string, string> = {
      accept: 'application/json',
      'x-apisports-key': this.config.apiKey
    };
    if (this.config.apiHost) headers['x-rapidapi-host'] = this.config.apiHost;

    const response = await this.fetchImpl(url.toString(), { headers });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`API-Football fixture request failed with HTTP ${response.status}${body ? `: ${body.slice(0, 160)}` : ''}`);
    }
    const payload = (await response.json()) as ApiFootballFixtureResponse;
    const fixture = payload.response?.[0];
    if (!fixture) throw new Error(`API-Football fixture ${providerFixtureId} response did not include fixture data.`);
    return fixture;
  }
}

export function parseApiFootballFixture(fixture: ApiFootballFixture): {
  rawStatus: string;
  homeScore?: number;
  awayScore?: number;
  minute?: number;
  providerUpdatedAt?: string;
} {
  return {
    rawStatus: apiFootballStatusToProviderStatus(fixture.fixture?.status),
    ...extractApiFootballScore(fixture),
    minute: toNumber(fixture.fixture?.status?.elapsed),
    providerUpdatedAt: fixture.fixture?.date
  };
}

export function apiFootballStatusToProviderStatus(status: ApiFootballStatus | undefined): string {
  const raw = status?.short ?? status?.long ?? 'UNKNOWN';
  const normalized = raw.trim().toUpperCase().replace(/[-\s]/g, '_');
  if (['TBD', 'NS', 'TBA', 'NOT_STARTED', 'TIME_TO_BE_DEFINED'].includes(normalized)) return 'SCHEDULED';
  if (['1H', '2H', 'LIVE', 'IN_PLAY', 'FIRST_HALF', 'SECOND_HALF'].includes(normalized)) return 'LIVE';
  if (['HT', 'HALF_TIME', 'HALFTIME'].includes(normalized)) return 'HT';
  if (['ET', 'EXTRA_TIME'].includes(normalized)) return 'ET';
  if (['P', 'PENALTY_IN_PROGRESS'].includes(normalized)) return 'PEN';
  if (['FT', 'AET', 'PEN', 'MATCH_FINISHED', 'FINISHED', 'AFTER_EXTRA_TIME', 'AFTER_PENALTIES'].includes(normalized)) return 'FINISHED';
  if (['PST', 'POSTP', 'POSTPONED'].includes(normalized)) return 'POSTPONED';
  if (['SUSP', 'SUSPENDED', 'INT'].includes(normalized)) return 'SUSPENDED';
  return raw;
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
    warning: `API-Football fixture id is missing for internal match ${match.id}; provider call skipped.`
  };
}

function extractApiFootballScore(fixture: ApiFootballFixture): { homeScore?: number; awayScore?: number } {
  const fulltimeHome = toNumber(fixture.score?.fulltime?.home);
  const fulltimeAway = toNumber(fixture.score?.fulltime?.away);
  return {
    homeScore: fulltimeHome ?? toNumber(fixture.goals?.home),
    awayScore: fulltimeAway ?? toNumber(fixture.goals?.away)
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
