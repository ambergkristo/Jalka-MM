import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { calculateMatchPredictionPoints, type MatchResultForScoring } from '../domain/pointsEngine.js';
import { predictionRepository } from '../domain/predictionRepository.js';

interface AuditOptions {
  source: 'db' | 'provider';
  player: string;
  expected?: number;
  providerBaseUrl: string;
  productionUrl?: string;
  checkFixture: string;
}

interface AuditMatch extends MatchResultForScoring {
  homeTeam: string;
  awayTeam: string;
  homeCode?: string;
  awayCode?: string;
  providerFixtureId?: string;
  source: string;
  status: string;
  contributesToLeaderboard: boolean;
}

interface ProviderGame {
  id?: unknown;
  home_team_name_en?: unknown;
  away_team_name_en?: unknown;
  home_score?: unknown;
  away_score?: unknown;
  finished?: unknown;
  type?: unknown;
}

interface ProviderMapping {
  providerFixtureId: string;
  matchedInternalMatchId?: number;
  confidence?: string;
}

const options = parseOptions(process.argv.slice(2));
const players = predictionRepository.getPlayers();
const targetPlayer = players.find((player) => sameText(player.name, options.player) || sameText(player.id, options.player));
let dbModule: typeof import('../server/db.js') | undefined;

if (!targetPlayer) {
  console.error(`Player not found: ${options.player}`);
  process.exitCode = 1;
} else {
  const matches = options.source === 'db' ? await readDbConfirmedMatches() : await readProviderFinishedMatches(options.providerBaseUrl);
  const productionLeaderboard = options.productionUrl ? await readProductionLeaderboard(options.productionUrl, targetPlayer.id) : undefined;

  printFixtureCheck(options.checkFixture, matches);
  printIncludedMatches(matches);
  printPlayerBreakdown(targetPlayer.id, targetPlayer.name, matches, options.expected, productionLeaderboard);
  printMissingMatchImpact(matches);

  await dbModule?.db.close().catch(() => undefined);
}

function parseOptions(args: string[]): AuditOptions {
  const value = (name: string): string | undefined => {
    const prefix = `--${name}=`;
    return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  };
  const source = value('source') === 'provider' ? 'provider' : 'db';
  const expectedValue = value('expected');
  return {
    source,
    player: value('player') ?? 'Aron Suluste',
    expected: expectedValue === undefined ? undefined : Number(expectedValue),
    providerBaseUrl: value('provider-base-url') ?? process.env.OPEN_WORLDCUP_API_BASE_URL ?? 'https://worldcup26.ir',
    productionUrl: value('production-url') ?? process.env.PUBLIC_APP_BASE_URL,
    checkFixture: value('check') ?? 'ESP-EGY'
  };
}

async function readDbConfirmedMatches(): Promise<AuditMatch[]> {
  const { db, migrate } = await loadDbModule();
  await migrate();
  const rows = await db.all(`
    SELECT
      r.match_id,
      COALESCE(r.confirmed_home_score, r.home_score) AS home_score,
      COALESCE(r.confirmed_away_score, r.away_score) AS away_score,
      r.status,
      r.public_status,
      r.is_final,
      r.provider,
      r.provider_fixture_id,
      r.raw_provider_status,
      COALESCE(home.name, m.home_slot) AS home_team,
      COALESCE(away.name, m.away_slot) AS away_team,
      home.code AS home_code,
      away.code AS away_code
    FROM match_results r
    JOIN matches m ON m.id = r.match_id
    LEFT JOIN teams home ON home.id = m.home_team_id
    LEFT JOIN teams away ON away.id = m.away_team_id
    WHERE r.public_status = 'CONFIRMED_FINAL' AND r.is_final = 1
    ORDER BY r.match_id
  `);
  return rows.flatMap((row) => {
    const homeScore = toNumber(row.home_score);
    const awayScore = toNumber(row.away_score);
    if (homeScore === undefined || awayScore === undefined) return [];
    return [{
      matchId: Number(row.match_id),
      homeScore,
      awayScore,
      isFinal: Number(row.is_final ?? 0) === 1,
      homeTeam: String(row.home_team),
      awayTeam: String(row.away_team),
      homeCode: optionalString(row.home_code),
      awayCode: optionalString(row.away_code),
      providerFixtureId: optionalString(row.provider_fixture_id),
      source: optionalString(row.provider) ?? 'database',
      status: `${row.status ?? 'unknown'} / ${row.public_status ?? 'unknown'} / ${row.raw_provider_status ?? 'unknown'}`,
      contributesToLeaderboard: true
    }];
  });
}

async function loadDbModule(): Promise<typeof import('../server/db.js')> {
  dbModule ??= await import('../server/db.js');
  return dbModule;
}

async function readProviderFinishedMatches(providerBaseUrl: string): Promise<AuditMatch[]> {
  const mapping = readProviderMapping();
  const mappingByFixture = new Map(mapping.map((entry) => [String(entry.providerFixtureId), entry]));
  const matchById = readCanonicalMatchMap();
  const response = await fetch(`${trimTrailingSlash(providerBaseUrl)}/get/games`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Open-WorldCup request failed with HTTP ${response.status}`);
  const payload = await response.json() as unknown;
  const games = Array.isArray(payload)
    ? payload as ProviderGame[]
    : isRecord(payload) && Array.isArray(payload.data)
      ? payload.data as ProviderGame[]
      : isRecord(payload) && Array.isArray(payload.games)
        ? payload.games as ProviderGame[]
        : [];
  return games.flatMap((game) => {
    const providerFixtureId = optionalString(game.id);
    const mappingEntry = providerFixtureId ? mappingByFixture.get(providerFixtureId) : undefined;
    if (!providerFixtureId || !mappingEntry || mappingEntry.confidence !== 'high' || !mappingEntry.matchedInternalMatchId) return [];
    if (!isFinishedFlag(game.finished)) return [];
    const homeScore = toNumber(game.home_score);
    const awayScore = toNumber(game.away_score);
    if (homeScore === undefined || awayScore === undefined) return [];
    const canonical = matchById.get(mappingEntry.matchedInternalMatchId);
    return [{
      matchId: mappingEntry.matchedInternalMatchId,
      homeScore,
      awayScore,
      isFinal: true,
      homeTeam: canonical?.homeTeam ?? String(game.home_team_name_en ?? 'Unknown home'),
      awayTeam: canonical?.awayTeam ?? String(game.away_team_name_en ?? 'Unknown away'),
      homeCode: canonical?.homeCode,
      awayCode: canonical?.awayCode,
      providerFixtureId,
      source: 'open-worldcup',
      status: `finished=${String(game.finished)}; type=${String(game.type ?? 'unknown')}`,
      contributesToLeaderboard: true
    }];
  }).sort((a, b) => a.matchId - b.matchId);
}

function readProviderMapping(): ProviderMapping[] {
  const raw = JSON.parse(readFileSync(join(process.cwd(), 'imports', 'open-worldcup-fixtures-2026.candidate.json'), 'utf8')) as { fixtures?: ProviderMapping[] };
  return raw.fixtures ?? [];
}

function readCanonicalMatchMap(): Map<number, { homeTeam: string; awayTeam: string; homeCode?: string; awayCode?: string }> {
  const matches = JSON.parse(readFileSync(join(process.cwd(), 'src', 'data', 'worldcup2026', 'matches.json'), 'utf8')) as Array<{
    id: number;
    homeTeamId?: string;
    awayTeamId?: string;
    homeSlot: string;
    awaySlot: string;
  }>;
  const teams = JSON.parse(readFileSync(join(process.cwd(), 'src', 'data', 'worldcup2026', 'teams.json'), 'utf8')) as Array<{
    id: string;
    code?: string;
    name?: string;
  }>;
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  return new Map(matches.map((match) => {
    const home = match.homeTeamId ? teamsById.get(match.homeTeamId) : undefined;
    const away = match.awayTeamId ? teamsById.get(match.awayTeamId) : undefined;
    return [match.id, {
      homeTeam: home?.name ?? match.homeSlot,
      awayTeam: away?.name ?? match.awaySlot,
      homeCode: home?.code,
      awayCode: away?.code
    }];
  }));
}

async function readProductionLeaderboard(productionUrl: string, playerId: string): Promise<{ rank?: number; points?: number; matchesScored?: number } | undefined> {
  const response = await fetch(`${trimTrailingSlash(productionUrl)}/api/leaderboard`, { cache: 'no-store' });
  if (!response.ok) return undefined;
  const payload = await response.json() as unknown;
  const entries = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.entries)
      ? payload.entries
      : isRecord(payload) && Array.isArray(payload.leaderboard)
        ? payload.leaderboard
        : [];
  return entries.find((entry) => entry.playerId === playerId);
}

function printFixtureCheck(fixture: string, matches: AuditMatch[]): void {
  const [homeCode, awayCode] = fixture.split('-').map((part) => part.trim().toUpperCase());
  const exact = matches.find((match) => match.homeCode === homeCode && match.awayCode === awayCode);
  console.log(`\nFixture check: ${fixture}`);
  if (exact) {
    console.log(`- INCLUDED: match ${exact.matchId} ${exact.homeTeam} ${exact.homeScore}-${exact.awayScore} ${exact.awayTeam}`);
    return;
  }
  const related = matches.filter((match) => match.homeCode === homeCode || match.awayCode === homeCode || match.homeCode === awayCode || match.awayCode === awayCode);
  console.log('- Not found as a literal canonical fixture in the included scoring set.');
  if (related.length > 0) {
    console.log('- Related included matches:');
    for (const match of related) {
      console.log(`  ${match.matchId}: ${match.homeCode ?? '---'}-${match.awayCode ?? '---'} ${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}`);
    }
  }
}

function printIncludedMatches(matches: AuditMatch[]): void {
  console.log(`\nFinished matches included in audit scoring: ${matches.length}`);
  for (const match of matches) {
    console.log(
      `${match.matchId}. ${match.homeCode ?? '---'}-${match.awayCode ?? '---'} ${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}` +
      ` | source=${match.source}` +
      `${match.providerFixtureId ? ` fixture=${match.providerFixtureId}` : ''}` +
      ` | status=${match.status}` +
      ` | scores=${match.contributesToLeaderboard ? 'yes' : 'no'}`
    );
  }
}

function printPlayerBreakdown(
  playerId: string,
  playerName: string,
  matches: AuditMatch[],
  expected: number | undefined,
  productionLeaderboard: { rank?: number; points?: number; matchesScored?: number } | undefined
): void {
  const predictions = predictionRepository.getMatchPredictions(playerId);
  const predictionByMatch = new Map(predictions.map((prediction) => [prediction.matchId, prediction]));
  let total = 0;
  console.log(`\n${playerName} scoring breakdown:`);
  for (const match of matches) {
    const prediction = predictionByMatch.get(match.matchId);
    if (!prediction) {
      console.log(`${match.matchId}. ${match.homeTeam}-${match.awayTeam}: no prediction | actual ${match.homeScore}-${match.awayScore} | 0 | missing prediction`);
      continue;
    }
    const result = calculateMatchPredictionPoints(prediction, match);
    total += result.points;
    console.log(
      `${match.matchId}. ${match.homeTeam}-${match.awayTeam}: predicted ${prediction.homeScore}-${prediction.awayScore}` +
      ` | actual ${match.homeScore}-${match.awayScore}` +
      ` | ${result.points} pts | ${reasonFor(result)}`
    );
  }
  console.log(`Computed total: ${total}`);
  if (expected !== undefined) console.log(`Expected total: ${expected} | delta=${expected - total}`);
  if (productionLeaderboard) {
    console.log(`Production leaderboard: rank=${productionLeaderboard.rank ?? 'n/a'} points=${productionLeaderboard.points ?? 'n/a'} matchesScored=${productionLeaderboard.matchesScored ?? 'n/a'}`);
  }
}

function printMissingMatchImpact(matches: AuditMatch[]): void {
  const belgiumEgypt = matches.find((match) => match.homeCode === 'BEL' && match.awayCode === 'EGY');
  if (!belgiumEgypt) return;
  const predictions = predictionRepository.getMatchPredictions();
  const playersById = new Map(predictionRepository.getPlayers().map((player) => [player.id, player.name]));
  const impacted = predictions
    .filter((prediction) => prediction.matchId === belgiumEgypt.matchId)
    .map((prediction) => ({
      player: playersById.get(prediction.playerId) ?? prediction.playerId,
      prediction: `${prediction.homeScore}-${prediction.awayScore}`,
      points: calculateMatchPredictionPoints(prediction, belgiumEgypt).points
    }))
    .filter((row) => row.points > 0)
    .sort((a, b) => b.points - a.points || a.player.localeCompare(b.player, 'et'));
  console.log(`\nIf BEL-EGY was missing before rebuild, affected players with non-zero points: ${impacted.length}`);
  for (const row of impacted) {
    console.log(`- ${row.player}: ${row.prediction}, +${row.points}`);
  }
}

function reasonFor(result: ReturnType<typeof calculateMatchPredictionPoints>): string {
  if (result.exactScore) return 'exact';
  if (result.correctResult && result.correctGoalDifference) return 'goal difference';
  if (result.correctResult) return 'outcome';
  return 'incorrect';
}

function sameText(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase('et') === right.trim().toLocaleLowerCase('et');
}

function optionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value);
  return text === '' || text.toLowerCase() === 'null' ? undefined : text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function isFinishedFlag(value: unknown): boolean {
  const text = String(value).trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'finished' || text === 'final';
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}
