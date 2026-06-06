import type { ProviderSpecificConfig } from './resultProviderConfig.js';
import { toResultUpdate, type ResultProvider } from './resultProvider.js';
import type { ResultUpdate, TrackedMatch } from './resultTypes.js';

type FetchLike = (url: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json' | 'text'>>;

interface OpenWorldCupGameResponse {
  id?: number | string;
  home_score?: number | string | null;
  away_score?: number | string | null;
  finished?: boolean | string | null;
  type?: string;
  status?: string;
  state?: string;
  local_date?: string;
  updated_at?: string;
  last_updated?: string;
  stadium_id?: number | string;
  stadium_name?: string;
  venue?: string;
  home_team_label?: string;
  away_team_label?: string;
  goalscorers?: Array<unknown>;
  goal_scorers?: Array<unknown>;
  events?: Array<unknown>;
}

interface OpenWorldCupGamesResponse {
  response?: OpenWorldCupGameResponse[] | OpenWorldCupGameResponse;
  data?: OpenWorldCupGameResponse[] | OpenWorldCupGameResponse;
  games?: OpenWorldCupGameResponse[];
  matches?: OpenWorldCupGameResponse[];
}

export class OpenWorldCupResultProvider implements ResultProvider {
  readonly name = 'open-worldcup-result-provider';
  readonly mode = 'live' as const;

  constructor(
    private readonly config: ProviderSpecificConfig,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  async fetchMatchUpdate(match: TrackedMatch, now: Date): Promise<ResultUpdate> {
    try {
      const game = await this.fetchGame(String(match.id));
      if (!game) {
        return warningUpdate(match, now, this.name, `Open World Cup game ${match.id} response did not include match data.`);
      }

      const providerStatus = normalizeStatus(game);
      const homeScore = toNumber(game.home_score);
      const awayScore = toNumber(game.away_score);
      return toResultUpdate({
        match,
        provider: this.name,
        providerMatchId: String(game.id ?? match.id),
        providerStatus,
        now,
        homeScore,
        awayScore,
        providerUpdatedAt: game.updated_at ?? game.last_updated ?? game.local_date,
        nextCheckAt: match.nextCheckAt
      });
    } catch (error) {
      return warningUpdate(
        match,
        now,
        this.name,
        error instanceof Error ? error.message : 'Open World Cup provider request failed.'
      );
    }
  }

  private async fetchGame(gameId: string): Promise<OpenWorldCupGameResponse | undefined> {
    if (!this.config.apiBaseUrl) throw new Error('OPEN_WORLDCUP_API_BASE_URL is required for open-worldcup provider.');

    const baseUrl = trimTrailingSlash(this.config.apiBaseUrl);
    const directUrl = new URL(`${baseUrl}/get/game/${gameId}`);
    const headers: Record<string, string> = { accept: 'application/json' };
    if (this.config.apiKey) headers.authorization = `Bearer ${this.config.apiKey}`;

    const response = await this.fetchImpl(directUrl.toString(), { headers });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Open World Cup fixture request failed with HTTP ${response.status}${body ? `: ${body.slice(0, 160)}` : ''}`);
    }
    const payload = (await response.json()) as OpenWorldCupGamesResponse;
    return firstGame(payload);
  }
}

export function normalizeOpenWorldCupGame(game: OpenWorldCupGameResponse): {
  rawStatus: string;
  homeScore?: number;
  awayScore?: number;
  providerUpdatedAt?: string;
} {
  return {
    rawStatus: normalizeStatus(game),
    homeScore: toNumber(game.home_score),
    awayScore: toNumber(game.away_score),
    providerUpdatedAt: game.updated_at ?? game.last_updated ?? game.local_date
  };
}

function normalizeStatus(game: OpenWorldCupGameResponse): string {
  const raw = String(game.status ?? game.state ?? game.type ?? game.finished ?? 'scheduled');
  if (game.finished === true || raw.toUpperCase() === 'TRUE') return 'FINISHED';
  if (raw.toUpperCase().includes('LIVE')) return 'LIVE';
  if (['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'].includes(raw.toUpperCase())) return 'SCHEDULED';
  if (raw.toUpperCase().includes('FINISH')) return 'FINISHED';
  if (raw.toUpperCase().includes('PAUSE') || raw.toUpperCase().includes('HT')) return 'HT';
  return raw.toUpperCase();
}

function firstGame(payload: OpenWorldCupGamesResponse): OpenWorldCupGameResponse | undefined {
  const direct = payload.response ?? payload.data ?? payload.games ?? payload.matches;
  if (Array.isArray(direct)) return direct[0];
  return direct ?? undefined;
}

function warningUpdate(match: TrackedMatch, now: Date, provider: string, warning: string): ResultUpdate {
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
    warning
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
