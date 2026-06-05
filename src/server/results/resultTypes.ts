export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'HT' | 'ET' | 'PEN' | 'FINISHED' | 'POSTPONED' | 'SUSPENDED';
export type PublicResultStatus = 'SCHEDULED' | 'LIVE' | 'CONFIRMING' | 'CONFIRMED_FINAL' | 'NEEDS_REVIEW';

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
  publicStatus?: PublicResultStatus;
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
  pointsRecalculatedAt?: string;
  provisionalHomeScore?: number;
  provisionalAwayScore?: number;
  provisionalStatus?: MatchStatus;
  confirmedHomeScore?: number;
  confirmedAwayScore?: number;
  confirmedAt?: string;
  confirmationSource?: string;
  confirmationConfidence?: 'provider-repeat' | 'provider-agreement' | 'manual';
  needsReviewReason?: string;
  lastProviderCheckAt?: string;
  nextConfirmationCheckAt?: string;
  providerResults?: ProviderResultObservation[];
  warning?: string;
}

export interface ProviderResultObservation {
  provider: string;
  matchId: number;
  status: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  minute?: number;
  isFinal: boolean;
  observedAt: string;
  providerFixtureId?: string;
  rawProviderStatus?: string;
  confidence?: 'low' | 'medium' | 'high' | 'confirmed';
  providerUpdatedAt?: string;
  warnings?: string[];
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
    matchesScored?: number;
    matchPoints?: number;
    groupBonusPoints?: number;
    playoffBonusPoints?: number;
    topScorerBonusPoints?: number;
    totalPoints?: number;
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
  lastLeaderboardRebuildAt?: string;
}

export interface ResultAgentRunSummary extends ResultAgentStatus {
  startedAt: string;
  finishedAt: string;
  checkedMatches: number;
  updatesApplied: number;
  finalizedResults: number;
  dryRun: boolean;
  updatedMatches: number;
  finalizedMatches: number;
  confirmationPending: number;
  needsReview: number;
  leaderboardRebuilt: boolean;
  playersProcessed: number;
  warnings: string[];
  leaderboardRebuilds: LeaderboardRebuildResult[];
}

export interface ResultsAgentRepository {
  listTrackedMatches(): Promise<TrackedMatch[]>;
  getMatchResult(matchId: number): Promise<ResultUpdate | undefined>;
  getProviderResultObservations(matchId: number): Promise<ProviderResultObservation[]>;
  saveResultUpdate(update: ResultUpdate): Promise<{ finalResultChanged: boolean }>;
  getFinalizedResults(): Promise<ResultUpdate[]>;
  getStatus(provider: string, now: Date): Promise<ResultAgentStatus>;
  markPointsRecalculated(matchId: number, timestamp: string): Promise<void>;
  saveRunSummary(summary: ResultAgentRunSummary): Promise<void>;
}
