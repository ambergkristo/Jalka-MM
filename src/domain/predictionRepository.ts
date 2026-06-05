import awardsSeed from '../data/predictions/awardsPredictions.json' with { type: 'json' };
import groupSeed from '../data/predictions/groupPredictions.json' with { type: 'json' };
import knockoutSeed from '../data/predictions/knockoutPredictions.json' with { type: 'json' };
import leaderboardSeed from '../data/predictions/leaderboardSeed.json' with { type: 'json' };
import playersSeed from '../data/players.json' with { type: 'json' };

export interface Player {
  id: string;
  name: string;
  location?: string;
  avatarUrl?: string;
  createdAt?: string;
}

export interface GroupPrediction {
  playerId: string;
  group: string;
  first: string;
  second: string;
  third: string;
}

export type KnockoutRound = 'R32' | 'R16' | 'QF' | 'SF' | 'Final';

export interface KnockoutRoundPrediction {
  round: KnockoutRound;
  teams: string[];
}

export interface KnockoutPrediction {
  playerId: string;
  rounds: KnockoutRoundPrediction[];
}

export type PredictionStatus = 'Still alive' | 'Eliminated' | 'Won Tournament';
export type TopScorerPredictionStatus = 'Leading' | 'In chase' | 'Eliminated';

export interface AwardsPrediction {
  playerId: string;
  championTeam: string;
  championStatus: PredictionStatus;
  topScorerName: string;
  topScorerTeam: string;
  topScorerCurrentGoals: number;
  topScorerStatus: TopScorerPredictionStatus;
}

export interface LeaderboardEntry {
  playerId: string;
  rank: number;
  points: number;
  exactScores: number;
  correctResults: number;
  hitRate: number;
  previousRank?: number;
  lastUpdatedAt: string;
}

export interface PredictionBundle {
  player: Player;
  leaderboardEntry?: LeaderboardEntry;
  groupPredictions: GroupPrediction[];
  knockoutPrediction?: KnockoutPrediction;
  awardsPrediction?: AwardsPrediction;
  errors: string[];
}

export interface PredictionSeedData {
  players: Player[];
  groupPredictions: GroupPrediction[];
  knockoutPredictions: KnockoutPrediction[];
  awardsPredictions: AwardsPrediction[];
  leaderboard: LeaderboardEntry[];
}

export interface PredictionSeedLoadResult {
  data: PredictionSeedData;
  errors: string[];
}

export interface PredictionRepository {
  getPlayers(): Player[];
  getPlayerById(playerId: string): Player | undefined;
  getGroupPredictions(playerId?: string): GroupPrediction[];
  getKnockoutPredictions(playerId?: string): KnockoutPrediction[];
  getAwardsPredictions(playerId?: string): AwardsPrediction[];
  getPlayerPredictionBundle(playerId: string): PredictionBundle | undefined;
  getLeaderboard(): LeaderboardEntry[];
  getErrors(): string[];
}

interface RawGroupPredictionSet {
  playerId: string;
  groups: Array<Omit<GroupPrediction, 'playerId'>>;
}

const emptySeedData: PredictionSeedData = {
  players: [],
  groupPredictions: [],
  knockoutPredictions: [],
  awardsPredictions: [],
  leaderboard: []
};
const validGroupIds = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']);

export function loadPredictionSeedData(raw: {
  players: unknown;
  groupPredictions: unknown;
  knockoutPredictions: unknown;
  awardsPredictions: unknown;
  leaderboard: unknown;
}): PredictionSeedLoadResult {
  const errors: string[] = [];
  const players = asArray<Player>(raw.players, 'players', errors).filter((player) => isString(player.id, 'players.id', errors) && isString(player.name, 'players.name', errors));
  const groupPredictions = normalizeGroupPredictions(raw.groupPredictions, errors);
  const knockoutPredictions = asArray<KnockoutPrediction>(raw.knockoutPredictions, 'knockoutPredictions', errors);
  const awardsPredictions = asArray<AwardsPrediction>(raw.awardsPredictions, 'awardsPredictions', errors);
  const leaderboard = asArray<LeaderboardEntry>(raw.leaderboard, 'leaderboard', errors);
  const data = { players, groupPredictions, knockoutPredictions, awardsPredictions, leaderboard };
  errors.push(...validatePredictionSeedData(data));
  return { data: errors.length ? { ...emptySeedData, players } : data, errors };
}

export function validatePredictionSeedData(data: PredictionSeedData): string[] {
  const errors: string[] = [];
  const playerIds = new Set<string>();
  const duplicateIds = new Set<string>();
  for (const player of data.players) {
    if (!player.id) errors.push('Player is missing id.');
    if (playerIds.has(player.id)) duplicateIds.add(player.id);
    playerIds.add(player.id);
  }
  for (const id of duplicateIds) errors.push(`Duplicate player id: ${id}`);

  const checkPlayerReference = (kind: string, playerId: string) => {
    if (!playerIds.has(playerId)) errors.push(`${kind} references missing player: ${playerId}`);
  };
  for (const row of data.leaderboard) checkPlayerReference('Leaderboard entry', row.playerId);
  for (const row of data.groupPredictions) checkPlayerReference('Group prediction', row.playerId);
  for (const row of data.knockoutPredictions) checkPlayerReference('Knockout prediction', row.playerId);
  for (const row of data.awardsPredictions) checkPlayerReference('Awards prediction', row.playerId);

  const groupsByPlayer = groupBy(data.groupPredictions, (prediction) => prediction.playerId);
  for (const player of data.players) {
    const predictions = groupsByPlayer.get(player.id) ?? [];
    const groups = new Set(predictions.map((prediction) => prediction.group));
    if (groups.size > 0 && groups.size !== 12) errors.push(`Player ${player.id} has ${groups.size} group predictions; expected 12.`);
    if (groups.size !== predictions.length) errors.push(`Player ${player.id} has duplicate group predictions.`);
    for (const group of groups) {
      if (!validGroupIds.has(group)) errors.push(`Player ${player.id} has invalid group prediction: ${group}`);
    }
  }

  return errors;
}

export class JsonPredictionRepository implements PredictionRepository {
  private readonly data: PredictionSeedData;
  private readonly errors: string[];

  constructor(loadResult: PredictionSeedLoadResult = loadDefaultPredictionSeedData()) {
    this.data = loadResult.data;
    this.errors = loadResult.errors;
  }

  getPlayers(): Player[] {
    return [...this.data.players];
  }

  getPlayerById(playerId: string): Player | undefined {
    return this.data.players.find((player) => player.id === playerId);
  }

  getGroupPredictions(playerId?: string): GroupPrediction[] {
    return this.filterByPlayer(this.data.groupPredictions, playerId);
  }

  getKnockoutPredictions(playerId?: string): KnockoutPrediction[] {
    return this.filterByPlayer(this.data.knockoutPredictions, playerId);
  }

  getAwardsPredictions(playerId?: string): AwardsPrediction[] {
    return this.filterByPlayer(this.data.awardsPredictions, playerId);
  }

  getPlayerPredictionBundle(playerId: string): PredictionBundle | undefined {
    const player = this.getPlayerById(playerId);
    if (!player) return undefined;
    const bundleErrors = this.errors.filter((error) => error.includes(playerId));
    return {
      player,
      leaderboardEntry: this.data.leaderboard.find((row) => row.playerId === playerId),
      groupPredictions: this.getGroupPredictions(playerId),
      knockoutPrediction: this.getKnockoutPredictions(playerId)[0],
      awardsPrediction: this.getAwardsPredictions(playerId)[0],
      errors: bundleErrors
    };
  }

  getLeaderboard(): LeaderboardEntry[] {
    return [...this.data.leaderboard].sort((a, b) => a.rank - b.rank);
  }

  getErrors(): string[] {
    return [...this.errors];
  }

  private filterByPlayer<T extends { playerId: string }>(rows: T[], playerId?: string): T[] {
    return rows.filter((row) => !playerId || row.playerId === playerId);
  }
}

export const predictionRepository: PredictionRepository = new JsonPredictionRepository();

export function loadDefaultPredictionSeedData(): PredictionSeedLoadResult {
  return loadPredictionSeedData({
    players: playersSeed,
    groupPredictions: groupSeed,
    knockoutPredictions: knockoutSeed,
    awardsPredictions: awardsSeed,
    leaderboard: leaderboardSeed
  });
}

function normalizeGroupPredictions(raw: unknown, errors: string[]): GroupPrediction[] {
  const rows = asArray<RawGroupPredictionSet>(raw, 'groupPredictions', errors);
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object' || !Array.isArray(row.groups)) {
      errors.push('Group prediction row must include groups.');
      return [];
    }
    return row.groups.map((group) => ({ ...group, playerId: row.playerId }));
  });
}

function asArray<T>(value: unknown, label: string, errors: string[]): T[] {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array.`);
    return [];
  }
  return value as T[];
}

function isString(value: unknown, label: string, errors: string[]): value is string {
  if (typeof value === 'string' && value.trim().length > 0) return true;
  errors.push(`${label} must be a non-empty string.`);
  return false;
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const groupKey = key(row);
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), row]);
  }
  return groups;
}
