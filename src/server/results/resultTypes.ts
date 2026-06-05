export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'HT' | 'ET' | 'PEN' | 'FINISHED' | 'POSTPONED' | 'SUSPENDED';

export interface TrackedMatch {
  id: number;
  providerMatchId?: string;
  kickoffUtc: string;
  status: MatchStatus;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  minute?: number;
  isFinal: boolean;
  lastCheckedAt?: string;
  nextCheckAt?: string;
}

export interface ResultUpdate {
  matchId: number;
  providerMatchId?: string;
  status: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  minute?: number;
  period?: 'REGULAR' | 'EXTRA_TIME' | 'PENALTIES';
  isFinal: boolean;
  lastCheckedAt: string;
  nextCheckAt?: string;
  provider: string;
  rawProviderStatus?: string;
  providerUpdatedAt?: string;
  warning?: string;
}

export interface MatchUpdatePlan {
  matchId: number;
  shouldCheckNow: boolean;
  reason: string;
  nextCheckAt?: string;
}

export interface LeaderboardRebuildResult {
  recalculatedAt: string;
  playersProcessed: number;
  matchesProcessed: number;
  changedEntries: number;
  entries: Array<{
    playerId: string;
    rank: number;
    points: number;
    exactScores: number;
    correctResults: number;
    hitRate: number;
    previousRank?: number;
    lastUpdatedAt: string;
  }>;
  warnings: string[];
}

export interface ResultAgentStatus {
  lastRunAt?: string;
  nextSuggestedRunAt?: string;
  staleMatchesCount: number;
  provider: string;
  mode: 'mock' | 'live';
}

export interface ResultAgentRunSummary extends ResultAgentStatus {
  startedAt: string;
  finishedAt: string;
  checkedMatches: number;
  updatesApplied: number;
  finalizedResults: number;
  leaderboardRebuilds: LeaderboardRebuildResult[];
}

export interface ResultsAgentRepository {
  listTrackedMatches(): Promise<TrackedMatch[]>;
  saveResultUpdate(update: ResultUpdate): Promise<{ finalResultChanged: boolean }>;
  getFinalizedResults(): Promise<ResultUpdate[]>;
  getStatus(provider: string, now: Date): Promise<ResultAgentStatus>;
  saveRunSummary(summary: ResultAgentRunSummary): Promise<void>;
}
