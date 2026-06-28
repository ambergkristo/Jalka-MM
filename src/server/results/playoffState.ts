import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import matchesJson from '../../data/worldcup2026/matches.json' with { type: 'json' };
import teamsJson from '../../data/worldcup2026/teams.json' with { type: 'json' };
import type { Match, Team } from '../../domain/types.js';
import { canonicalTeamName, resolveCanonicalTeam } from '../../domain/teamNames.js';
import { fetchOpenWorldCupGames } from './openWorldCupResultProvider.js';
import { loadResultProviderConfig } from './resultProviderConfig.js';

export interface CanonicalPlayoffFixture {
  matchId: number;
  stage: Match['stage'];
  kickoffAt?: string;
  venue?: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeTeamCode?: string;
  awayTeamCode?: string;
  homeLabel?: string;
  awayLabel?: string;
  homeScore?: number;
  awayScore?: number;
  status: 'scheduled' | 'live' | 'finished';
  winnerTeamId?: string;
}

export interface CanonicalPlayoffState {
  generatedAt: string;
  fixtures: CanonicalPlayoffFixture[];
  bracketFixturesByMatchId: Map<number, CanonicalPlayoffFixture>;
  groupStageComplete: boolean;
  confirmedGroupStageMatches: number;
  r32FixturesKnownCount: number;
  upcomingPlayoffFixturesCount: number;
}

export interface BuildCanonicalPlayoffStateOptions {
  now?: Date;
  confirmedGroupStageMatches?: number;
}

interface CandidateFixtureFile {
  apiBaseUrl?: string;
  fixtures?: CandidateFixture[];
}

interface ProviderGame {
  id?: number | string;
  type?: string;
  finished?: boolean | string | null;
  time_elapsed?: number | string | null;
  status?: string;
  state?: string;
  local_date?: string;
  venue?: string;
  stadium_name?: string;
  home_score?: number | string | null;
  away_score?: number | string | null;
  home_team_name_en?: string;
  away_team_name_en?: string;
  home_team_label?: string;
  away_team_label?: string;
}

interface CandidateFixture {
  providerFixtureId: string;
  matchedInternalMatchId?: number;
  confidence?: 'high' | 'medium' | 'low';
  kickoffUtc?: string;
  venue?: string;
}

const internalMatches = matchesJson as Array<Match & { venue?: string }>;
const seededTeams = teamsJson as Team[];
const candidateFilePath = join(process.cwd(), 'imports', 'open-worldcup-fixtures-2026.candidate.json');
const canonicalTeamById = new Map(seededTeams.map((team) => [team.id, team]));

export async function buildCanonicalPlayoffState(options: BuildCanonicalPlayoffStateOptions = {}): Promise<CanonicalPlayoffState> {
  const now = options.now ?? new Date();
  const confirmedGroupStageMatches = Math.max(0, Math.min(options.confirmedGroupStageMatches ?? 0, 72));
  const groupStageComplete = confirmedGroupStageMatches >= 72;
  const fixtures = groupStageComplete
    ? await fetchCanonicalPlayoffFixtures(now).catch(() => [])
    : [];
  const bracketFixturesByMatchId = new Map(fixtures.map((fixture) => [fixture.matchId, fixture]));
  return {
    generatedAt: now.toISOString(),
    fixtures,
    bracketFixturesByMatchId,
    groupStageComplete,
    confirmedGroupStageMatches,
    r32FixturesKnownCount: fixtures.filter((fixture) => fixture.stage === 'R32' && fixture.homeTeamId && fixture.awayTeamId).length,
    upcomingPlayoffFixturesCount: fixtures.filter((fixture) => fixture.status === 'scheduled').length
  };
}

async function fetchCanonicalPlayoffFixtures(now: Date): Promise<CanonicalPlayoffFixture[]> {
  const candidateFile = readCandidateFixtureFile();
  const config = loadResultProviderConfig();
  const apiBaseUrl = config.openWorldCup.apiBaseUrl ?? candidateFile.apiBaseUrl ?? 'https://worldcup26.ir';
  const games = await fetchOpenWorldCupGames({ apiBaseUrl, apiKey: config.openWorldCup.apiKey }, fetch).catch(() => []);
  const candidatesByMatchId = new Map(
    (candidateFile.fixtures ?? [])
      .filter((fixture) => fixture.confidence === 'high' && Number.isInteger(fixture.matchedInternalMatchId) && (fixture.matchedInternalMatchId ?? 0) >= 73)
      .map((fixture) => [fixture.matchedInternalMatchId as number, fixture])
  );
  const gameByMatchId = new Map<number, ProviderGame>();
  for (const game of games) {
    const providerFixtureId = String(game.id ?? '');
    const candidate = (candidateFile.fixtures ?? []).find((fixture) => fixture.providerFixtureId === providerFixtureId && fixture.confidence === 'high');
    if (!candidate?.matchedInternalMatchId || candidate.matchedInternalMatchId < 73) continue;
    gameByMatchId.set(candidate.matchedInternalMatchId, game);
  }

  return internalMatches
    .filter((match) => match.id >= 73)
    .map((match) => toCanonicalPlayoffFixture(match, candidatesByMatchId.get(match.id), gameByMatchId.get(match.id), now))
    .sort((left, right) => {
      const leftKickoff = left.kickoffAt ? Date.parse(left.kickoffAt) : Number.POSITIVE_INFINITY;
      const rightKickoff = right.kickoffAt ? Date.parse(right.kickoffAt) : Number.POSITIVE_INFINITY;
      return leftKickoff - rightKickoff || left.matchId - right.matchId;
    });
}

function toCanonicalPlayoffFixture(
  match: Match & { venue?: string },
  candidate: CandidateFixture | undefined,
  game: ProviderGame | undefined,
  now: Date
): CanonicalPlayoffFixture {
  const homeTeam = resolvePlayoffTeam(game?.home_team_name_en, game?.home_team_label, match.homeTeamId, match.homeSlot);
  const awayTeam = resolvePlayoffTeam(game?.away_team_name_en, game?.away_team_label, match.awayTeamId, match.awaySlot);
  const kickoffAt = candidate?.kickoffUtc ?? parseProviderKickoff(game?.local_date);
  const status = classifyPlayoffStatus(game, kickoffAt, now);
  const homeScore = numberOrUndefined(game?.home_score);
  const awayScore = numberOrUndefined(game?.away_score);

  return {
    matchId: match.id,
    stage: match.stage,
    kickoffAt,
    venue: game?.venue ?? game?.stadium_name ?? candidate?.venue ?? match.venue,
    homeTeam: homeTeam.displayName,
    awayTeam: awayTeam.displayName,
    homeTeamId: homeTeam.team?.id,
    awayTeamId: awayTeam.team?.id,
    homeTeamCode: homeTeam.team?.code,
    awayTeamCode: awayTeam.team?.code,
    homeLabel: stringOrUndefined(game?.home_team_label) ?? match.homeSlot,
    awayLabel: stringOrUndefined(game?.away_team_label) ?? match.awaySlot,
    homeScore,
    awayScore,
    status,
    winnerTeamId: resolveWinnerTeamId(homeTeam.team, awayTeam.team, homeScore, awayScore, status)
  };
}

function resolvePlayoffTeam(
  providerName: string | undefined,
  providerLabel: string | undefined,
  teamId: string | undefined,
  fallbackSlot: string
): { displayName: string; team?: Team } {
  const seededTeam = teamId ? canonicalTeamById.get(teamId) : undefined;
  if (providerName) {
    const canonical = resolveCanonicalTeam(providerName);
    if (canonical) {
      return {
        displayName: canonical.displayName,
        team: canonicalTeamById.get(canonical.id)
      };
    }
    if (!isPlaceholderName(providerName)) return { displayName: canonicalTeamName(providerName) };
  }
  if (providerLabel && !isPlaceholderName(providerLabel)) {
    const canonical = resolveCanonicalTeam(providerLabel);
    return canonical
      ? { displayName: canonical.displayName, team: canonicalTeamById.get(canonical.id) }
      : { displayName: canonicalTeamName(providerLabel) };
  }
  if (seededTeam) return { displayName: seededTeam.nameEt ?? seededTeam.name, team: seededTeam };
  return { displayName: providerLabel ?? fallbackSlot };
}

function classifyPlayoffStatus(game: ProviderGame | undefined, kickoffAt: string | undefined, now: Date): CanonicalPlayoffFixture['status'] {
  const normalized = normalizePlayoffStatus(game);
  if (normalized === 'finished') return 'finished';
  if (normalized === 'live') return 'live';
  return 'scheduled';
}

function resolveWinnerTeamId(
  homeTeam: Team | undefined,
  awayTeam: Team | undefined,
  homeScore: number | undefined,
  awayScore: number | undefined,
  status: CanonicalPlayoffFixture['status']
): string | undefined {
  if (status !== 'finished' || homeScore === undefined || awayScore === undefined || homeScore === awayScore) return undefined;
  return homeScore > awayScore ? homeTeam?.id : awayTeam?.id;
}

function readCandidateFixtureFile(): CandidateFixtureFile {
  if (!existsSync(candidateFilePath)) return {};
  return JSON.parse(readFileSync(candidateFilePath, 'utf8')) as CandidateFixtureFile;
}

function parseProviderKickoff(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  if (!hasExplicitTimezone(normalized)) return undefined;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function isPlaceholderName(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('winner ') ||
    normalized.startsWith('runner-up ') ||
    normalized.startsWith('group ') ||
    normalized.startsWith('3rd ') ||
    normalized.includes('third place');
}

function isFinishedToken(value: ProviderGame['finished']): boolean {
  return value === true || String(value ?? '').trim().toLowerCase() === 'true';
}

function isFinishedValue(value: string | undefined): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'finished' || normalized === 'ft' || normalized === 'full_time';
}

function isLiveValue(value: string | undefined): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'live' || normalized === 'in_play' || normalized === '1h' || normalized === '2h' || normalized === 'ht';
}

function normalizePlayoffStatus(game: ProviderGame | undefined): 'live' | 'finished' | 'scheduled' {
  const raw = String(game?.status ?? game?.state ?? '').trim().toLowerCase();
  const elapsed = String(game?.time_elapsed ?? '').trim().toLowerCase();
  const finished = String(game?.finished ?? '').trim().toLowerCase();
  if (isFinishedToken(game?.finished) || isFinishedValue(game?.status) || isFinishedValue(game?.state) || isFinishedValue(elapsed) || finished === 'true') {
    return 'finished';
  }
  if (isLiveValue(game?.status) || isLiveValue(game?.state) || isLiveValue(elapsed) || raw === 'in_progress' || raw === 'in play') {
    return 'live';
  }
  return 'scheduled';
}

function hasExplicitTimezone(value: string): boolean {
  return /(?:z|[+-]\d{2}:\d{2})$/i.test(value);
}

function numberOrUndefined(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function stringOrUndefined(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return String(value);
}
