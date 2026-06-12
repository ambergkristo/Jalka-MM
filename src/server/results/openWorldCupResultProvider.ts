import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProviderSpecificConfig } from './resultProviderConfig.js';
import { toResultUpdate, type ResultProvider } from './resultProvider.js';
import type { ResultScorer, ResultUpdate, TrackedMatch } from './resultTypes.js';

type FetchLike = (url: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json' | 'text'>>;

interface OpenWorldCupGameResponse {
  id?: number | string;
  home_score?: number | string | null;
  away_score?: number | string | null;
  home_scorers?: unknown;
  away_scorers?: unknown;
  home_team_id?: number | string;
  away_team_id?: number | string;
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

interface OpenWorldCupCandidateFile {
  fixtures?: Array<{
    providerFixtureId: string;
    matchedInternalMatchId?: number;
    confidence: 'high' | 'medium' | 'low';
    notes?: string;
  }>;
}

interface OpenWorldCupFixtureLookup {
  fixtureIdByMatchId: Map<number, string>;
}

const OPEN_WORLDCUP_CANDIDATE_FILE = join(process.cwd(), 'imports', 'open-worldcup-fixtures-2026.candidate.json');
const DEFAULT_FIXTURE_LOOKUP = loadFixtureLookup();

export class OpenWorldCupResultProvider implements ResultProvider {
  readonly name = 'open-worldcup-result-provider';
  readonly mode = 'live' as const;
  private gamesCachePromise?: Promise<OpenWorldCupGameResponse[]>;

  constructor(
    private readonly config: ProviderSpecificConfig,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly fixtureLookup: OpenWorldCupFixtureLookup = DEFAULT_FIXTURE_LOOKUP
  ) {}

  async fetchMatchUpdate(match: TrackedMatch, now: Date): Promise<ResultUpdate> {
    try {
      const providerFixtureId = this.fixtureLookup.fixtureIdByMatchId.get(match.id);
      if (!providerFixtureId) {
        return warningUpdate(
          match,
          now,
          this.name,
          `Open World Cup candidate map has no high-confidence fixture for internal match ${match.id}; skipped until manually verified.`
        );
      }

      const game = await this.fetchGame(providerFixtureId);
      if (!game) {
        return warningUpdate(match, now, this.name, `Open World Cup game ${providerFixtureId} response did not include match data.`);
      }

      const providerStatus = normalizeStatus(game);
      const homeScore = toNumber(game.home_score);
      const awayScore = toNumber(game.away_score);
      const scorers = [
        ...parseScorers(game.home_scorers, match.homeTeam, game.home_team_id),
        ...parseScorers(game.away_scorers, match.awayTeam, game.away_team_id)
      ];
      return toResultUpdate({
        match,
        provider: this.name,
        providerMatchId: providerFixtureId,
        providerStatus,
        now,
        homeScore,
        awayScore,
        providerUpdatedAt: game.updated_at ?? game.last_updated ?? game.local_date,
        nextCheckAt: match.nextCheckAt,
        scorers: scorers.length > 0 ? scorers : undefined
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

    const games = await this.fetchGames();
    return games.find((game) => String(game.id ?? '') === gameId);
  }

  private async fetchGames(): Promise<OpenWorldCupGameResponse[]> {
    if (!this.gamesCachePromise) this.gamesCachePromise = this.fetchGamesOnce();
    return this.gamesCachePromise;
  }

  private async fetchGamesOnce(): Promise<OpenWorldCupGameResponse[]> {
    if (!this.config.apiBaseUrl) throw new Error('OPEN_WORLDCUP_API_BASE_URL is required for open-worldcup provider.');

    const baseUrl = trimTrailingSlash(this.config.apiBaseUrl);
    const directUrl = new URL(`${baseUrl}/get/games`);
    const headers: Record<string, string> = { accept: 'application/json' };
    if (this.config.apiKey) headers.authorization = `Bearer ${this.config.apiKey}`;

    const response = await this.fetchImpl(directUrl.toString(), { headers });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Open World Cup fixture request failed with HTTP ${response.status}${body ? `: ${body.slice(0, 160)}` : ''}`);
    }
    const payload = (await response.json()) as OpenWorldCupGamesResponse;
    return collectGames(payload);
  }
}

export function buildOpenWorldCupFixtureLookup(candidateFile: OpenWorldCupCandidateFile): OpenWorldCupFixtureLookup {
  const fixtureIdByMatchId = new Map<number, string>();
  for (const fixture of candidateFile.fixtures ?? []) {
    if (fixture.confidence !== 'high') continue;
    const internalMatchId = fixture.matchedInternalMatchId;
    if (typeof internalMatchId !== 'number' || !Number.isInteger(internalMatchId) || internalMatchId <= 0) continue;
    const providerFixtureId = fixture.providerFixtureId.trim();
    if (!providerFixtureId) continue;
    fixtureIdByMatchId.set(internalMatchId, providerFixtureId);
  }
  return { fixtureIdByMatchId };
}

export function loadFixtureLookup(): OpenWorldCupFixtureLookup {
  try {
    if (!existsSync(OPEN_WORLDCUP_CANDIDATE_FILE)) return { fixtureIdByMatchId: new Map() };
    const raw = readFileSync(OPEN_WORLDCUP_CANDIDATE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as OpenWorldCupCandidateFile;
    return buildOpenWorldCupFixtureLookup(parsed);
  } catch {
    return { fixtureIdByMatchId: new Map() };
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
  if (isTruthyFinished(game.finished, raw)) return 'FINISHED';
  if (raw.toUpperCase().includes('LIVE')) return 'LIVE';
  if (['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'].includes(raw.toUpperCase())) return 'SCHEDULED';
  if (raw.toUpperCase().includes('FINISH')) return 'FINISHED';
  if (raw.toUpperCase().includes('PAUSE') || raw.toUpperCase().includes('HT')) return 'HT';
  return raw.toUpperCase();
}

function isTruthyFinished(finished: OpenWorldCupGameResponse['finished'], raw: string): boolean {
  if (finished === true) return true;
  if (typeof finished === 'string' && ['TRUE', '1', 'YES', 'Y'].includes(finished.trim().toUpperCase())) return true;
  return raw.toUpperCase() === 'TRUE';
}

function collectGames(payload: OpenWorldCupGamesResponse): OpenWorldCupGameResponse[] {
  const direct = payload.response ?? payload.data ?? payload.games ?? payload.matches;
  if (Array.isArray(direct)) return direct.filter((item) => item && typeof item === 'object') as OpenWorldCupGameResponse[];
  return direct && typeof direct === 'object' ? [direct as OpenWorldCupGameResponse] : [];
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

function parseScorers(value: unknown, teamName: string, teamCode?: unknown): ResultScorer[] {
  const names = extractScorerNames(value);
  return names.flatMap((name) => {
    const playerName = normalizeScorerName(name);
    if (!playerName) return [];
    return [{ playerName, teamName, teamCode: typeof teamCode === 'string' ? teamCode : undefined, goals: 1 }];
  });
}

function extractScorerNames(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap((item) => extractScorerNames(item));
  if (typeof value !== 'string') return [];
  const raw = value.trim();
  if (!raw || ['NULL', 'N/A', 'NONE', '[]', '{}'].includes(raw.toUpperCase())) return [];
  const normalized = raw.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'");
  const quoted = [...normalized.matchAll(/"([^"]+)"/g)].map((match) => match[1].trim()).filter(Boolean);
  if (quoted.length > 0) return quoted;
  const body = normalized.replace(/^[{[]|[}\]]$/g, '').trim();
  if (!body) return [];
  return body.split(',').map((part) => part.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
}

function normalizeScorerName(value: string): string {
  return value
    .replace(/\s*\(?\d+(?:\+\d+)?['’]?\)?\s*$/u, '')
    .replace(/\s*\b(?:pen\.?|penalty|own goal|og)\b.*$/iu, '')
    .trim();
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}
