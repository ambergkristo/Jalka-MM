import type { LeaderboardEntry } from '../../domain/predictionRepository.js';
import type { LeaderboardRebuildResult } from './resultTypes.js';

export interface LeaderboardMetadata {
  lastRebuildAt?: string;
  playersProcessed: number;
  matchesProcessed: number;
  changedEntries: number;
  warnings: string[];
}

export interface LeaderboardRepository {
  getLeaderboard(): Promise<LeaderboardEntry[]>;
  replaceLeaderboard(entries: LeaderboardEntry[], metadata: LeaderboardRebuildResult): Promise<void>;
  getLeaderboardMetadata(): Promise<LeaderboardMetadata>;
}
