import type { ProviderMatchMapEntry } from './providerMatchMap.js';
import { findProviderMatchMapEntry } from './providerMatchMap.js';
import { toResultUpdate, type ResultProvider } from './resultProvider.js';
import type { ResultProviderConfig } from './resultProviderConfig.js';
import type { ResultUpdate, TrackedMatch } from './resultTypes.js';

type FetchLike = (url: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json' | 'text'>>;

interface SportmonksFixtureResponse {
  data?: SportmonksFixture | SportmonksFixture[];
}

interface SportmonksFixture {
  id?: number | string;
  state?: SportmonksState;
  scores?: SportmonksScore[];
  periods?: SportmonksPeriod[];
  time?: { minute?: number | string };
  minute?: number | string;
  updated_at?: string;
}

interface SportmonksState {
  name?: string;
  short_name?: string;
  code?: string;
}

interface SportmonksScore {
  description?: string;
  score?: {
    goals?: number | string;
    participant?: string;
  };
}

interface SportmonksPeriod {
  type?: string;
  minutes?: number | string;
}

export class SportmonksResultProvider implements ResultProvider {
  readonly name = 'sportmonks-result-provider';
  readonly mode = 'live' as const;

  constructor(
    private readonly config: ResultProviderConfig,
    private readonly matchMap: ProviderMatchMapEntry[],
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  async fetchMatchUpdate(match: TrackedMatch, now: Date): Promise<ResultUpdate> {
    const mapEntry = findProviderMatchMapEntry({
      entries: this.matchMap,
      provider: 'sportmonks',
      internalMatchId: match.id,
      competitionId: this.config.competitionId,
      season: this.config.season
    });
    const providerFixtureId = mapEntry?.providerFixtureId ?? match.providerMatchId;
    if (!providerFixtureId) return missingFixtureUpdate(match, now, this.name);

    const fixture = await this.fetchFixture(providerFixtureId);
    const parsed = parseSportmonksFixture(fixture);
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

  private async fetchFixture(providerFixtureId: string): Promise<SportmonksFixture> {
    if (!this.config.apiBaseUrl) throw new Error('RESULTS_API_BASE_URL is required for Sportmonks result provider.');
    if (!this.config.apiKey) throw new Error('RESULTS_API_KEY is required for Sportmonks result provider.');

    const url = new URL(`/v3/football/fixtures/${providerFixtureId}`, trimTrailingSlash(this.config.apiBaseUrl));
    url.searchParams.set('api_token', this.config.apiKey);
    url.searchParams.set('include', 'scores;state;periods');

    const response = await this.fetchImpl(url.toString(), { headers: { accept: 'application/json' } });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Sportmonks fixture request failed with HTTP ${response.status}${body ? `: ${body.slice(0, 160)}` : ''}`);
    }
    const payload = (await response.json()) as SportmonksFixtureResponse;
    const fixture = Array.isArray(payload.data) ? payload.data[0] : payload.data;
    if (!fixture) throw new Error(`Sportmonks fixture ${providerFixtureId} response did not include fixture data.`);
    return fixture;
  }
}

export function parseSportmonksFixture(fixture: SportmonksFixture): {
  rawStatus: string;
  homeScore?: number;
  awayScore?: number;
  minute?: number;
  providerUpdatedAt?: string;
} {
  return {
    rawStatus: sportmonksStatusToProviderStatus(fixture.state),
    ...extractSportmonksScore(fixture.scores),
    minute: extractSportmonksMinute(fixture),
    providerUpdatedAt: fixture.updated_at
  };
}

export function sportmonksStatusToProviderStatus(state: SportmonksState | undefined): string {
  const raw = state?.short_name ?? state?.code ?? state?.name ?? 'UNKNOWN';
  const normalized = raw.trim().toUpperCase().replace(/[-\s]/g, '_');
  if (['NS', 'TBA', 'NOT_STARTED', 'UPCOMING'].includes(normalized)) return 'SCHEDULED';
  if (['LIVE', 'INPLAY', 'IN_PLAY', '1ST_HALF', 'FIRST_HALF', '1H', '2ND_HALF', 'SECOND_HALF', '2H'].includes(normalized)) return 'LIVE';
  if (['HT', 'HALF_TIME', 'HALFTIME'].includes(normalized)) return 'HT';
  if (['ET', 'EXTRA_TIME'].includes(normalized)) return 'ET';
  if (['PEN', 'PENALTIES', 'PENALTY_SHOOTOUT'].includes(normalized)) return 'PEN';
  if (['FT', 'AET', 'FT_PEN', 'FINISHED', 'FULL_TIME', 'AFTER_EXTRA_TIME', 'AFTER_PENALTIES'].includes(normalized)) return 'FINISHED';
  if (['POSTP', 'POSTPONED'].includes(normalized)) return 'POSTPONED';
  if (['SUSP', 'SUSPENDED', 'INTERRUPTED'].includes(normalized)) return 'SUSPENDED';
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
    warning: `Sportmonks fixture id is missing for internal match ${match.id}; provider call skipped.`
  };
}

function extractSportmonksScore(scores: SportmonksScore[] | undefined): { homeScore?: number; awayScore?: number } {
  if (!scores?.length) return {};
  const preferredScores = scores.filter((score) => ['CURRENT', 'FT', '2ND_HALF', '1ST_HALF'].includes(String(score.description ?? '').toUpperCase()));
  const rows = preferredScores.length ? preferredScores : scores;
  const home = rows.find((score) => String(score.score?.participant ?? '').toLowerCase() === 'home');
  const away = rows.find((score) => String(score.score?.participant ?? '').toLowerCase() === 'away');
  return {
    homeScore: toNumber(home?.score?.goals),
    awayScore: toNumber(away?.score?.goals)
  };
}

function extractSportmonksMinute(fixture: SportmonksFixture): number | undefined {
  const currentPeriod = fixture.periods?.find((period) => ['1st-half', '2nd-half', 'extra-time'].includes(String(period.type ?? '').toLowerCase()));
  return toNumber(fixture.minute) ?? toNumber(fixture.time?.minute) ?? toNumber(currentPeriod?.minutes);
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}
