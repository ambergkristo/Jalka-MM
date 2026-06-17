import type { LeaderboardEntry, Player } from './predictionRepository.js';

export interface CountyLeaderboardPlayer {
  playerId: string;
  playerName: string;
  points: number;
}

export interface CountyLeaderboardRow {
  rank: number;
  county: string;
  totalPoints: number;
  averagePoints: number;
  playerCount: number;
  topPlayers: CountyLeaderboardPlayer[];
}

interface CountyAccumulator {
  county: string;
  allPlayerPoints: number;
  players: CountyLeaderboardPlayer[];
}

const contributingPlayerLimit = 3;

const missingCountyLabel = 'Andmed puuduvad';
const countyAliases = new Map<string, string>([
  ['haapsalu', 'Haapsalu'],
  ['harku', 'Harku'],
  ['hiiumaa', 'Hiiumaa'],
  ['kambja', 'Kambja'],
  ['kanepi', 'Kanepi'],
  ['kastre', 'Kastre'],
  ['kiili', 'Kiili'],
  ['laane harju', 'Lääne-Harju'],
  ['lääne harju', 'Lääne-Harju'],
  ['lääne-harju', 'Lääne-Harju'],
  ['paide', 'Paide'],
  ['parnumaa', 'Pärnumaa'],
  ['pärnumaa', 'Pärnumaa'],
  ['rae', 'Rae'],
  ['rakvere', 'Rakvere'],
  ['rapla', 'Rapla'],
  ['rouge', 'Rõuge'],
  ['rõuge', 'Rõuge'],
  ['saaremaa', 'Saaremaa'],
  ['saku', 'Saku'],
  ['saue', 'Saue'],
  ['tallinn', 'Tallinn'],
  ['tallinna linn', 'Tallinn'],
  ['tartu', 'Tartu'],
  ['tartumaa', 'Tartumaa'],
  ['viimsi', 'Viimsi']
]);

export function buildCountyLeaderboard(input: {
  players: Player[];
  leaderboardEntries?: LeaderboardEntry[];
}): CountyLeaderboardRow[] {
  const entryByPlayerId = new Map((input.leaderboardEntries ?? []).map((entry) => [entry.playerId, entry]));
  const countyByName = new Map<string, CountyAccumulator>();

  for (const player of input.players) {
    const county = normalizeCountyName(player.location);
    const entry = entryByPlayerId.get(player.id);
    const points = entryPoints(entry);
    const accumulator = countyByName.get(county) ?? { county, allPlayerPoints: 0, players: [] };
    accumulator.allPlayerPoints += points;
    accumulator.players.push({
      playerId: player.id,
      playerName: player.name,
      points
    });
    countyByName.set(county, accumulator);
  }

  return [...countyByName.values()]
    .map((county) => {
      const sortedPlayers = [...county.players].sort((a, b) => b.points - a.points || a.playerName.localeCompare(b.playerName, 'et'));
      const topPlayers = sortedPlayers.slice(0, contributingPlayerLimit);
      const countyScore = topPlayers.reduce((sum, player) => sum + player.points, 0);
      return {
        rank: 0,
        county: county.county,
        totalPoints: countyScore,
        averagePoints: county.players.length === 0 ? 0 : county.allPlayerPoints / county.players.length,
        playerCount: county.players.length,
        topPlayers
      };
    })
    .sort(compareCountyRows)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export function normalizeCountyName(value: string | undefined): string {
  const text = value?.trim();
  if (!text) return missingCountyLabel;
  const normalized = normalizeLookupKey(text);
  return countyAliases.get(normalized) ?? toTitleCase(text.replace(/\s+/g, ' '));
}

function compareCountyRows(a: Omit<CountyLeaderboardRow, 'rank'>, b: Omit<CountyLeaderboardRow, 'rank'>): number {
  return (
    b.totalPoints - a.totalPoints ||
    a.county.localeCompare(b.county, 'et')
  );
}

function entryPoints(entry: LeaderboardEntry | undefined): number {
  return entry?.totalPoints ?? entry?.points ?? 0;
}

function normalizeLookupKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function toTitleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase('et') + part.slice(1).toLocaleLowerCase('et'))
    .join(' ');
}
