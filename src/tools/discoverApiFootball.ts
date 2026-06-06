import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import matchesSeed from '../data/worldcup2026/matches.json' with { type: 'json' };
import teamsSeed from '../data/worldcup2026/teams.json' with { type: 'json' };

const DEFAULT_API_BASE_URL = 'https://v3.football.api-sports.io';
const DEFAULT_LEAGUE_ID = 1;
const DEFAULT_SEASON = 2026;
const CANDIDATE_FILE_PATH = fileURLToPath(new URL('../../imports/api-football-fixtures-2026.candidate.json', import.meta.url));

export interface ApiFootballDiscoveryConfig {
  apiKey: string;
  apiBaseUrl: string;
  apiHost?: string;
  league: number;
  season: number;
}

export interface ApiFootballLeagueCoverage {
  fixtures?: Record<string, boolean>;
  standings?: boolean;
  players?: boolean;
  top_scorers?: boolean;
  top_assists?: boolean;
  top_cards?: boolean;
  injuries?: boolean;
  predictions?: boolean;
  odds?: boolean;
}

export interface ApiFootballDiscoveryLeague {
  response?: Array<{
    league?: {
      id?: number;
      name?: string;
      type?: string;
      logo?: string;
    };
    country?: {
      name?: string;
      code?: string;
      flag?: string;
    };
    seasons?: Array<{
      year?: number;
      current?: boolean;
      coverage?: ApiFootballLeagueCoverage;
    }>;
  }>;
}

export interface ApiFootballDiscoveryLeagueSummary {
  name?: string;
  country?: string;
  coverage?: ApiFootballLeagueCoverage;
}

export interface ApiFootballDiscoveryFixtures {
  response?: ApiFootballDiscoveryFixture[];
}

export interface ApiFootballDiscoveryFixture {
  fixture?: {
    id?: number | string;
    date?: string;
    status?: {
      short?: string;
      long?: string;
      elapsed?: number | string;
    };
    venue?: {
      name?: string;
    };
  };
  teams?: {
    home?: {
      name?: string;
    };
    away?: {
      name?: string;
    };
  };
}

export interface DiscoveryCandidateFixture {
  provider: 'api-football';
  providerFixtureId: string;
  kickoffUtc: string;
  homeTeam: string;
  awayTeam: string;
  venue?: string;
  rawStatus: string;
  matchedInternalMatchId?: number;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
}

export interface DiscoveryCandidateFile {
  provider: 'api-football';
  league: number;
  season: number;
  generatedAt: string;
  leagueAccessible: boolean;
  leagueName?: string;
  leagueCountry?: string;
  coverage?: ApiFootballLeagueCoverage;
  fixturesFound: number;
  candidateMappingCanBeGenerated: boolean;
  confidenceSummary: {
    high: number;
    medium: number;
    low: number;
  };
  fixtures: DiscoveryCandidateFixture[];
}

interface WorldCupMatchSeed {
  id: number;
  kickoffAt: string;
  homeSlot: string;
  awaySlot: string;
}

interface TeamSeed {
  code: string;
  name: string;
  nameEt?: string;
  name_et?: string;
}

const teamAliasEntries: Array<[string, string]> = [
  ['Bosnia', 'BIH'],
  ['Bosnia and Herzegovina', 'BIH'],
  ['Cape Verde', 'CPV'],
  ['Cabo Verde', 'CPV'],
  ['Curacao', 'CUW'],
  ['Curaçao', 'CUW'],
  ['Cote dIvoire', 'CIV'],
  ['Cote d Ivoire', 'CIV'],
  ["Cote d'Ivoire", 'CIV'],
  ['Czechia', 'CZE'],
  ['Czech Republic', 'CZE'],
  ['Iran', 'IRN'],
  ['IR Iran', 'IRN'],
  ['Paraguay', 'PAR'],
  ['South Korea', 'KOR'],
  ['Turkey', 'TUR'],
  ['Turkiye', 'TUR'],
  ['United Arab Emirates', 'UAE'],
  ['UAE', 'UAE'],
  ['USA', 'USA']
];

const teamCodeByName = buildTeamCodeLookup(teamsSeed as TeamSeed[]);
const worldCupMatches = matchesSeed as WorldCupMatchSeed[];

if (isMainModule()) {
  void run().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ status: 'failed', error: message }, null, 2));
    process.exitCode = 1;
  });
}

export async function runApiFootballDiscovery(env: NodeJS.ProcessEnv = process.env): Promise<DiscoveryCandidateFile> {
  const config = loadDiscoveryConfig(env);
  if (!config.apiKey.trim()) throw new Error('API_FOOTBALL_API_KEY is required for npm run api-football:discover');

  const [leaguePayload, fixturesPayload] = await Promise.all([
    fetchApiFootballJson<ApiFootballDiscoveryLeague>(config, '/leagues', { id: String(config.league), season: String(config.season) }),
    fetchApiFootballJson<ApiFootballDiscoveryFixtures>(config, '/fixtures', { league: String(config.league), season: String(config.season) })
  ]);

  const leagueEntry = leaguePayload.response?.[0];
  const league = leagueEntry ? {
    name: leagueEntry.league?.name,
    country: leagueEntry.country?.name,
    coverage: leagueEntry.seasons?.find((season) => season.year === config.season)?.coverage
      ?? leagueEntry.seasons?.find((season) => season.current)?.coverage
      ?? leagueEntry.seasons?.[0]?.coverage
  } : undefined;
  const fixtures = fixturesPayload.response ?? [];
  const discoveryFixtures = fixtures.map((fixture) => buildDiscoveryFixture(fixture));
  const candidateFile = buildCandidateFile({
    leagueAccessible: Boolean(leagueEntry),
    league,
    fixtures: discoveryFixtures
  });

  await mkdir(dirname(CANDIDATE_FILE_PATH), { recursive: true });
  await writeFile(CANDIDATE_FILE_PATH, `${JSON.stringify(candidateFile, null, 2)}\n`, 'utf8');

  return candidateFile;
}

export function loadDiscoveryConfig(env: NodeJS.ProcessEnv = process.env): ApiFootballDiscoveryConfig {
  const apiKey = env.API_FOOTBALL_API_KEY?.trim() ?? '';
  const apiBaseUrl = env.API_FOOTBALL_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
  const apiHost = env.API_FOOTBALL_HOST?.trim() || new URL(apiBaseUrl).host;

  return {
    apiKey,
    apiBaseUrl,
    apiHost,
    league: DEFAULT_LEAGUE_ID,
    season: DEFAULT_SEASON
  };
}

export function buildCandidateFile(input: {
  leagueAccessible: boolean;
  league?: ApiFootballDiscoveryLeagueSummary;
  fixtures: DiscoveryCandidateFixture[];
}): DiscoveryCandidateFile {
  const confidenceSummary = input.fixtures.reduce(
    (summary, fixture) => {
      summary[fixture.confidence] += 1;
      return summary;
    },
    { high: 0, medium: 0, low: 0 }
  );

  return {
    provider: 'api-football',
    league: DEFAULT_LEAGUE_ID,
    season: DEFAULT_SEASON,
    generatedAt: new Date().toISOString(),
    leagueAccessible: input.leagueAccessible,
    leagueName: input.league?.name,
    leagueCountry: input.league?.country,
    coverage: input.league?.coverage,
    fixturesFound: input.fixtures.length,
    candidateMappingCanBeGenerated: input.fixtures.length > 0,
    confidenceSummary,
    fixtures: input.fixtures
  };
}

export function buildDiscoveryFixture(fixture: ApiFootballDiscoveryFixture): DiscoveryCandidateFixture {
  const providerFixtureId = fixture.fixture?.id === undefined ? '' : String(fixture.fixture.id);
  const kickoffUtc = toUtcIso(fixture.fixture?.date);
  const homeTeam = fixture.teams?.home?.name?.trim() ?? '';
  const awayTeam = fixture.teams?.away?.name?.trim() ?? '';
  const venue = fixture.fixture?.venue?.name?.trim();
  const rawStatus = fixture.fixture?.status?.short?.trim() || fixture.fixture?.status?.long?.trim() || 'UNKNOWN';
  const match = findBestInternalMatch({ kickoffUtc, homeTeam, awayTeam });

  return {
    provider: 'api-football',
    providerFixtureId,
    kickoffUtc,
    homeTeam,
    awayTeam,
    venue: venue || undefined,
    rawStatus,
    matchedInternalMatchId: match.matchedInternalMatchId,
    confidence: match.confidence,
    notes: match.notes
  };
}

export function findBestInternalMatch(input: {
  kickoffUtc: string;
  homeTeam: string;
  awayTeam: string;
}): { matchedInternalMatchId?: number; confidence: 'high' | 'medium' | 'low'; notes: string } {
  const fixtureKickoff = Date.parse(input.kickoffUtc);
  if (!Number.isFinite(fixtureKickoff)) {
    return {
      confidence: 'low',
      notes: 'fixture kickoff could not be parsed'
    };
  }

  let bestMatch: { match: WorldCupMatchSeed; score: number; notes: string; confidence: 'high' | 'medium' | 'low' } | undefined;

  for (const match of worldCupMatches) {
    const matchKickoff = Date.parse(match.kickoffAt);
    if (!Number.isFinite(matchKickoff)) continue;

    const kickoffDeltaMs = Math.abs(matchKickoff - fixtureKickoff);
    if (kickoffDeltaMs > 15 * 60 * 1000) continue;

    const matchScore = scoreMatch({
      fixtureHome: input.homeTeam,
      fixtureAway: input.awayTeam,
      fixtureKickoff: input.kickoffUtc,
      internalHome: match.homeSlot,
      internalAway: match.awaySlot,
      internalKickoff: match.kickoffAt
    });

    if (!bestMatch || matchScore.score > bestMatch.score) {
      bestMatch = { match, score: matchScore.score, notes: matchScore.notes, confidence: matchScore.confidence };
    }
  }

  if (!bestMatch) {
    return {
      confidence: 'low',
      notes: 'no internal fixture matched the kickoff window'
    };
  }

  return {
    matchedInternalMatchId: bestMatch.confidence === 'high' ? bestMatch.match.id : undefined,
    confidence: bestMatch.confidence,
    notes: bestMatch.notes
  };
}

function scoreMatch(input: {
  fixtureHome: string;
  fixtureAway: string;
  fixtureKickoff: string;
  internalHome: string;
  internalAway: string;
  internalKickoff: string;
}): { score: number; confidence: 'high' | 'medium' | 'low'; notes: string } {
  const kickoffDiffMs = Math.abs(Date.parse(input.fixtureKickoff) - Date.parse(input.internalKickoff));
  const homeCodeFixture = resolveTeamCode(input.fixtureHome);
  const awayCodeFixture = resolveTeamCode(input.fixtureAway);
  const homeCodeInternal = resolveTeamCode(input.internalHome);
  const awayCodeInternal = resolveTeamCode(input.internalAway);
  const homeExact = Boolean(homeCodeFixture && homeCodeInternal && homeCodeFixture === homeCodeInternal);
  const awayExact = Boolean(awayCodeFixture && awayCodeInternal && awayCodeFixture === awayCodeInternal);
  const homePartial = namesPartiallyMatch(input.fixtureHome, input.internalHome);
  const awayPartial = namesPartiallyMatch(input.fixtureAway, input.internalAway);

  if (kickoffDiffMs <= 60_000 && homeExact && awayExact) {
    return { score: 5, confidence: 'high', notes: 'kickoff and both team names matched' };
  }

  if (kickoffDiffMs <= 60_000 && (homeExact || awayExact)) {
    return { score: 4, confidence: 'medium', notes: 'kickoff matched and one team name matched' };
  }

  if (kickoffDiffMs <= 60_000 && homePartial && awayPartial) {
    return { score: 3, confidence: 'low', notes: 'kickoff matched and both team names partially matched' };
  }

  if (kickoffDiffMs <= 60_000 && (homePartial || awayPartial)) {
    return { score: 2, confidence: 'low', notes: 'kickoff matched and one team name partially matched' };
  }

  if (kickoffDiffMs <= 15 * 60 * 1000 && homeExact && awayExact) {
    return { score: 2, confidence: 'medium', notes: 'team names matched but kickoff drifted beyond the exact window' };
  }

  return { score: 1, confidence: 'low', notes: 'kickoff matched loosely but team names did not align confidently' };
}

function resolveTeamCode(name: string): string | undefined {
  return teamCodeByName.get(normalizeTeamName(name));
}

function namesPartiallyMatch(left: string, right: string): boolean {
  const normalizedLeft = normalizeTeamName(left);
  const normalizedRight = normalizeTeamName(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  return normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft);
}

function buildTeamCodeLookup(teams: TeamSeed[]): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const team of teams) {
    registerTeamName(lookup, team.code, team.code);
    registerTeamName(lookup, team.name, team.code);
    registerTeamName(lookup, team.nameEt, team.code);
    registerTeamName(lookup, team.name_et, team.code);
  }

  for (const [alias, code] of teamAliasEntries) {
    registerTeamName(lookup, alias, code);
  }

  return lookup;
}

function registerTeamName(lookup: Map<string, string>, name: string | undefined, code: string): void {
  if (!name) return;
  lookup.set(normalizeTeamName(name), code);
}

function normalizeTeamName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/['’]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function toUtcIso(value: string | undefined): string {
  if (!value) return new Date(0).toISOString();
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return new Date(0).toISOString();
  return new Date(parsed).toISOString();
}

async function fetchApiFootballJson<T>(
  config: ApiFootballDiscoveryConfig,
  path: string,
  query: Record<string, string>
): Promise<T> {
  const url = new URL(path, config.apiBaseUrl);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

  const headers: Record<string, string> = {
    accept: 'application/json',
    'x-apisports-key': config.apiKey
  };
  if (config.apiHost) headers['x-rapidapi-host'] = config.apiHost;

  const response = await fetch(url.toString(), { headers });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`API-Football ${path} request failed with HTTP ${response.status}${body ? `: ${body.slice(0, 160)}` : ''}`);
  }

  return response.json() as Promise<T>;
}

function isMainModule(): boolean {
  if (process.argv.length < 2) return false;
  return import.meta.url === pathToFileURL(process.argv[1]).href;
}

async function run(): Promise<void> {
  const discovery = await runApiFootballDiscovery();
  const sample = discovery.fixtures[0];
  console.log(JSON.stringify({
    status: 'ok',
    keyLoaded: true,
    leagueId: discovery.league,
    season: discovery.season,
    leagueAccessible: discovery.leagueAccessible,
    fixturesFound: discovery.fixturesFound,
    sampleFixture: sample
      ? {
          providerFixtureId: sample.providerFixtureId,
          kickoffUtc: sample.kickoffUtc,
          homeTeam: sample.homeTeam,
          awayTeam: sample.awayTeam,
          status: sample.rawStatus
        }
      : null,
    candidateMapGenerated: discovery.candidateMappingCanBeGenerated,
    confidenceSummary: discovery.confidenceSummary,
    candidateFile: 'imports/api-football-fixtures-2026.candidate.json'
  }, null, 2));
}
