import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import matchesSeed from '../data/worldcup2026/matches.json' with { type: 'json' };

const DEFAULT_API_BASE_URL = 'https://worldcup26.ir';
const CANDIDATE_FILE_PATH = fileURLToPath(new URL('../../imports/open-worldcup-fixtures-2026.candidate.json', import.meta.url));
const TEAM_CANDIDATE_FILE_PATH = fileURLToPath(new URL('../../imports/open-worldcup-teams-2026.candidate.json', import.meta.url));

interface OpenWorldCupConfig {
  apiBaseUrl: string;
  apiToken?: string;
}

interface OpenWorldCupTeam {
  id?: number | string;
  name_en?: string;
  name_fa?: string;
  flag?: string;
  fifa_code?: string;
  iso2?: string;
  groups?: string;
}

interface OpenWorldCupGame {
  id?: number | string;
  home_score?: number | string | null;
  away_score?: number | string | null;
  status?: string;
  state?: string;
  type?: string;
  finished?: boolean | string | null;
  local_date?: string;
  stadium_id?: number | string;
  stadium_name?: string;
  home_team_label?: string;
  away_team_label?: string;
  home_team_name_en?: string;
  away_team_name_en?: string;
  home_team_id?: number | string;
  away_team_id?: number | string;
  goalscorers?: Array<unknown>;
  goal_scorers?: Array<unknown>;
  events?: Array<unknown>;
}

interface CandidateFile {
  provider: 'open-worldcup';
  apiBaseUrl: string;
  apiReachable: boolean;
  hostedApi: boolean;
  sourceRequiresHosting: boolean;
  teamEndpointReachable: boolean;
  teamsFound: number;
  matchesFound: number;
  candidateMappingCanBeGenerated: boolean;
  confidenceSummary: {
    high: number;
    medium: number;
    low: number;
    unmatched: number;
  };
  sampleMatch?: Record<string, unknown>;
  availableFields: {
    statusFields: string[];
    scoreFields: string[];
    goalscorerFields: string[];
  };
  notes: string[];
  fixtures: Array<{
    provider: 'open-worldcup';
    providerFixtureId: string;
    kickoffUtc: string;
    homeTeam: string;
    awayTeam: string;
    venue?: string;
    rawStatus: string;
    matchedInternalMatchId?: number;
    confidence: 'high' | 'medium' | 'low';
    notes: string;
  }>;
}

interface TeamCandidateFile {
  provider: 'open-worldcup';
  apiBaseUrl: string;
  apiReachable: boolean;
  hostedApi: boolean;
  sourceRequiresHosting: boolean;
  teamsFound: number;
  notes: string[];
  teams: Array<{
    providerTeamId: string;
    teamName: string;
    fifaCode?: string;
    iso2?: string;
    group?: string;
    flag?: string;
  }>;
}

type SeedMatch = (typeof matchesSeed)[number];

if (isMainModule()) {
  void run().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ status: 'failed', error: message }, null, 2));
    process.exitCode = 1;
  });
}

export async function runOpenWorldCupDiscovery(env: NodeJS.ProcessEnv = process.env): Promise<CandidateFile> {
  const config = loadConfig(env);
  const result = await fetchGames(config);
  const teamResult = await fetchTeams(config);
  const teamLookup = buildTeamLookup(teamResult.teams);
  const notes = [...result.notes];
  if (!result.apiReachable) notes.push('Hosted API was not reachable, so the provider should remain disabled by default.');
  if (result.requiresHosting) notes.push('The repository is open source, but it still needs a running hosted instance or self-hosting before it can be used operationally.');
  if (result.apiTokenUsed) notes.push('Discovery succeeded only with an auth token; treat read access as hosted/authenticated, not plain public.');
  if (teamResult.apiReachable) notes.push(`Team endpoint returned ${teamResult.teams.length} teams, so numeric ids can be resolved before mapping fixtures.`);
  const fixtures = result.games.map((game) => buildCandidateFixture(game, matchesSeed, teamLookup));
  const confidenceSummary = summarizeConfidenceSummary(fixtures);
  const candidateFile: CandidateFile = {
    provider: 'open-worldcup',
    apiBaseUrl: config.apiBaseUrl,
    apiReachable: result.apiReachable,
    hostedApi: result.hostedApi,
    sourceRequiresHosting: result.requiresHosting,
    teamEndpointReachable: teamResult.apiReachable,
    teamsFound: teamResult.teams.length,
    matchesFound: result.games.length,
    candidateMappingCanBeGenerated: confidenceSummary.high > 0 || confidenceSummary.medium > 0,
    confidenceSummary,
    sampleMatch: result.games[0] ? summarizeGame(result.games[0], teamLookup) : undefined,
    availableFields: {
      statusFields: ['status', 'state', 'type', 'finished'],
      scoreFields: ['home_score', 'away_score'],
      goalscorerFields: ['goalscorers', 'goal_scorers', 'events']
    },
    notes,
    fixtures
  };

  await mkdir(dirname(CANDIDATE_FILE_PATH), { recursive: true });
  await writeFile(CANDIDATE_FILE_PATH, `${JSON.stringify(candidateFile, null, 2)}\n`, 'utf8');
  await writeFile(TEAM_CANDIDATE_FILE_PATH, `${JSON.stringify(buildTeamCandidateFile(config, teamResult), null, 2)}\n`, 'utf8');
  return candidateFile;
}

function loadConfig(env: NodeJS.ProcessEnv): OpenWorldCupConfig {
  return {
    apiBaseUrl: env.OPEN_WORLDCUP_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL,
    apiToken: env.OPEN_WORLDCUP_API_TOKEN?.trim() || env.OPEN_WORLDCUP_API_KEY?.trim() || undefined
  };
}

async function fetchGames(config: OpenWorldCupConfig): Promise<{ apiReachable: boolean; hostedApi: boolean; requiresHosting: boolean; apiTokenUsed: boolean; games: OpenWorldCupGame[]; notes: string[] }> {
  const url = new URL('/get/games', trimTrailingSlash(config.apiBaseUrl));
  const headers: Record<string, string> = { accept: 'application/json' };
  if (config.apiToken) headers.authorization = `Bearer ${config.apiToken}`;

  try {
    const response = await fetch(url.toString(), { headers });
    const body = await response.text();
    if (!response.ok) {
      return {
        apiReachable: true,
        hostedApi: true,
        requiresHosting: true,
        apiTokenUsed: Boolean(config.apiToken),
        games: [],
        notes: [`Open World Cup API responded with HTTP ${response.status}.`, body ? body.slice(0, 200) : '']
      };
    }
    const payload = safeJsonParse(body);
    const games = collectGames(payload);
    return {
      apiReachable: true,
      hostedApi: true,
      requiresHosting: false,
      apiTokenUsed: Boolean(config.apiToken),
      games,
      notes: games.length > 0 ? ['Hosted API returned match data.'] : ['Hosted API responded, but no matches were returned.']
    };
  } catch (error) {
    return {
      apiReachable: false,
      hostedApi: true,
      requiresHosting: true,
      apiTokenUsed: Boolean(config.apiToken),
      games: [],
      notes: [error instanceof Error ? error.message : String(error)]
    };
  }
}

async function fetchTeams(config: OpenWorldCupConfig): Promise<{ apiReachable: boolean; hostedApi: boolean; requiresHosting: boolean; apiTokenUsed: boolean; teams: OpenWorldCupTeam[]; notes: string[] }> {
  const url = new URL('/get/teams', trimTrailingSlash(config.apiBaseUrl));
  const headers: Record<string, string> = { accept: 'application/json' };
  if (config.apiToken) headers.authorization = `Bearer ${config.apiToken}`;

  try {
    const response = await fetch(url.toString(), { headers });
    const body = await response.text();
    if (!response.ok) {
      return {
        apiReachable: true,
        hostedApi: true,
        requiresHosting: true,
        apiTokenUsed: Boolean(config.apiToken),
        teams: [],
        notes: [`Open World Cup team endpoint responded with HTTP ${response.status}.`, body ? body.slice(0, 200) : '']
      };
    }
    const payload = safeJsonParse(body);
    const teams = collectTeams(payload);
    return {
      apiReachable: true,
      hostedApi: true,
      requiresHosting: false,
      apiTokenUsed: Boolean(config.apiToken),
      teams,
      notes: teams.length > 0 ? ['Hosted team endpoint returned team metadata.'] : ['Hosted team endpoint responded, but no teams were returned.']
    };
  } catch (error) {
    return {
      apiReachable: false,
      hostedApi: true,
      requiresHosting: true,
      apiTokenUsed: Boolean(config.apiToken),
      teams: [],
      notes: [error instanceof Error ? error.message : String(error)]
    };
  }
}

export function collectGames(payload: unknown): OpenWorldCupGame[] {
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  const arrays = [record.response, record.data, record.games, record.matches].filter(Array.isArray) as OpenWorldCupGame[][];
  if (arrays.length > 0) return arrays[0].filter((item) => item && typeof item === 'object') as OpenWorldCupGame[];
  return [];
}

export function collectTeams(payload: unknown): OpenWorldCupTeam[] {
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  const arrays = [record.response, record.data, record.teams, record.countries].filter(Array.isArray) as OpenWorldCupTeam[][];
  if (arrays.length > 0) return arrays[0].filter((item) => item && typeof item === 'object') as OpenWorldCupTeam[];
  return [];
}

export function buildCandidateFixture(game: OpenWorldCupGame, seedMatches: SeedMatch[], teamLookup: Map<string, OpenWorldCupTeam>) {
  const resolvedHomeTeam = resolveTeamLabel(game.home_team_id, game.home_team_name_en ?? game.home_team_label, teamLookup);
  const resolvedAwayTeam = resolveTeamLabel(game.away_team_id, game.away_team_name_en ?? game.away_team_label, teamLookup);
  const bestMatch = findBestSeedMatch(game, seedMatches, resolvedHomeTeam, resolvedAwayTeam);
  return {
    provider: 'open-worldcup' as const,
    providerFixtureId: String(game.id ?? ''),
    kickoffUtc: toUtcIso(game.local_date),
    homeTeam: resolvedHomeTeam,
    awayTeam: resolvedAwayTeam,
    venue: game.stadium_name ? String(game.stadium_name) : game.stadium_id ? String(game.stadium_id) : undefined,
    rawStatus: normalizeStatus(game),
    matchedInternalMatchId: bestMatch.confidence !== 'low' ? bestMatch.match.id : undefined,
    confidence: bestMatch.confidence,
    notes: [summarizeNotes(game), bestMatch.notes].filter(Boolean).join('; ')
  };
}

export function summarizeGame(game: OpenWorldCupGame, teamLookup: Map<string, OpenWorldCupTeam>): Record<string, unknown> {
  const homeTeam = resolveTeamLabel(game.home_team_id, game.home_team_name_en ?? game.home_team_label, teamLookup);
  const awayTeam = resolveTeamLabel(game.away_team_id, game.away_team_name_en ?? game.away_team_label, teamLookup);
  return {
    providerFixtureId: String(game.id ?? ''),
    kickoffUtc: toUtcIso(game.local_date),
    homeTeam,
    awayTeam,
    status: normalizeStatus(game),
    score: `${toNumber(game.home_score) ?? '-'}-${toNumber(game.away_score) ?? '-'}`
  };
}

export function summarizeNotes(game: OpenWorldCupGame): string {
  const status = normalizeStatus(game);
  const scorersAvailable = Boolean((game.goalscorers?.length ?? 0) || (game.goal_scorers?.length ?? 0) || (game.events?.length ?? 0));
  return `${status}${scorersAvailable ? '; scorers/events available' : '; scorers/events not present in sample'}`;
}

export function findBestSeedMatch(game: OpenWorldCupGame, seedMatches: SeedMatch[], resolvedHomeTeam: string, resolvedAwayTeam: string): { match: SeedMatch; confidence: 'high' | 'medium' | 'low'; notes: string } {
  const scoredMatches = seedMatches.map((match) => {
    const kickoffDifference = kickoffDifferenceMinutes(game.local_date, match.kickoffAt);
    const sameCalendarDay = isSameCalendarDay(game.local_date, match.kickoffAt);
    const homeMatch = compareTeamNames(resolvedHomeTeam, match.homeSlot);
    const awayMatch = compareTeamNames(resolvedAwayTeam, match.awaySlot);
    const exactKickoff = kickoffDifference === 0;
    const exactNames = homeMatch === 'exact' && awayMatch === 'exact';
    const partialNames = homeMatch !== 'none' || awayMatch !== 'none';
    const score = (exactKickoff ? 6 : 0) + (sameCalendarDay ? 3 : 0) + (homeMatch === 'exact' ? 3 : homeMatch === 'partial' ? 1 : 0) + (awayMatch === 'exact' ? 3 : awayMatch === 'partial' ? 1 : 0);
    const confidence: 'high' | 'medium' | 'low' = exactKickoff && exactNames
      ? 'high'
      : exactNames
        ? 'medium'
        : partialNames
          ? 'low'
          : 'low';
    return {
      match,
      score,
      confidence,
      notes: `match ${match.id}: kickoff ${kickoffDifference === null ? 'unknown' : `${Math.abs(kickoffDifference)}m off`}, same day ${sameCalendarDay ? 'yes' : 'no'}, home ${homeMatch}, away ${awayMatch}`
    };
  });

  const best = scoredMatches.sort((left, right) => right.score - left.score || left.match.id - right.match.id)[0];
  if (!best || best.score === 0) {
    return {
      match: seedMatches[0] ?? ({ id: 0 } as SeedMatch),
      confidence: 'low',
      notes: 'no confident schedule match found'
    };
  }
  return { match: best.match, confidence: best.confidence, notes: best.notes };
}

export function buildTeamLookup(teams: OpenWorldCupTeam[]): Map<string, OpenWorldCupTeam> {
  return new Map(teams.flatMap((team) => {
    const id = String(team.id ?? '').trim();
    if (!id) return [];
    return [[id, team]];
  }));
}

export function buildTeamCandidateFile(config: OpenWorldCupConfig, teamResult: { apiReachable: boolean; hostedApi: boolean; requiresHosting: boolean; teams: OpenWorldCupTeam[]; notes: string[] }): TeamCandidateFile {
  return {
    provider: 'open-worldcup',
    apiBaseUrl: config.apiBaseUrl,
    apiReachable: teamResult.apiReachable,
    hostedApi: teamResult.hostedApi,
    sourceRequiresHosting: teamResult.requiresHosting,
    teamsFound: teamResult.teams.length,
    notes: teamResult.notes,
    teams: teamResult.teams.map((team) => ({
      providerTeamId: String(team.id ?? ''),
      teamName: String(team.name_en ?? ''),
      fifaCode: team.fifa_code ? String(team.fifa_code) : undefined,
      iso2: team.iso2 ? String(team.iso2) : undefined,
      group: team.groups ? String(team.groups) : undefined,
      flag: team.flag ? String(team.flag) : undefined
    }))
  };
}

export function resolveTeamLabel(teamId: number | string | undefined, fallbackName: string | undefined, teamLookup: Map<string, OpenWorldCupTeam>): string {
  const normalizedId = String(teamId ?? '').trim();
  const lookup = normalizedId ? teamLookup.get(normalizedId) : undefined;
  return String(lookup?.name_en ?? fallbackName ?? normalizedId ?? '').trim();
}

export function summarizeConfidenceSummary(fixtures: Array<{ confidence: 'high' | 'medium' | 'low'; matchedInternalMatchId?: number }>): CandidateFile['confidenceSummary'] {
  return fixtures.reduce((summary, fixture) => {
    summary[fixture.confidence] += 1;
    if (fixture.matchedInternalMatchId === undefined) summary.unmatched += 1;
    return summary;
  }, { high: 0, medium: 0, low: 0, unmatched: 0 });
}

function compareTeamNames(actual: string | number | undefined, expected: string | number | undefined): 'exact' | 'partial' | 'none' {
  const left = normalizeTeamName(actual);
  const right = normalizeTeamName(expected);
  if (!left || !right) return 'none';
  if (left === right) return 'exact';
  if (left.includes(right) || right.includes(left)) return 'partial';
  return 'none';
}

function normalizeTeamName(value: string | number | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();
}

function kickoffDifferenceMinutes(actual: string | undefined, expected: string | undefined): number | null {
  const actualMs = toMillis(actual);
  const expectedMs = toMillis(expected);
  if (actualMs === null || expectedMs === null) return null;
  return Math.round((actualMs - expectedMs) / 60000);
}

function isSameCalendarDay(actual: string | undefined, expected: string | undefined): boolean {
  const actualDay = toDayKey(actual);
  const expectedDay = toDayKey(expected);
  return Boolean(actualDay && expectedDay && actualDay === expectedDay);
}

function toMillis(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDayKey(value: string | undefined): string | null {
  const parsed = toMillis(value);
  if (parsed === null) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function normalizeStatus(game: OpenWorldCupGame): string {
  const raw = String(game.status ?? game.state ?? '').trim();
  if (game.finished === true || raw.toUpperCase() === 'TRUE') return 'FINISHED';
  if (raw) return raw.toUpperCase();
  if (game.home_score !== undefined || game.away_score !== undefined) return 'LIVE';
  return 'SCHEDULED';
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function toUtcIso(value: string | undefined): string {
  if (!value) return new Date(0).toISOString();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(0).toISOString();
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function isMainModule(): boolean {
  if (process.argv.length < 2) return false;
  return import.meta.url === pathToFileURL(process.argv[1]).href;
}

async function run(): Promise<void> {
  const discovery = await runOpenWorldCupDiscovery();
  console.log(JSON.stringify({
    status: 'ok',
    apiReachable: discovery.apiReachable,
    matchesFound: discovery.matchesFound,
    teamsFound: discovery.teamsFound,
    sampleMatch: discovery.sampleMatch,
    statusFields: discovery.availableFields.statusFields,
    scoreFields: discovery.availableFields.scoreFields,
    goalscorerFields: discovery.availableFields.goalscorerFields,
    candidateMappingCanBeGenerated: discovery.candidateMappingCanBeGenerated,
    confidenceSummary: discovery.confidenceSummary,
    notes: discovery.notes,
    candidateFiles: [
      'imports/open-worldcup-fixtures-2026.candidate.json',
      'imports/open-worldcup-teams-2026.candidate.json'
    ]
  }, null, 2));
}
