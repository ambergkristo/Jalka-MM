export type Stage = 'GROUP' | 'R32' | 'R16' | 'QF' | 'SF' | 'THIRD_PLACE' | 'FINAL';
export type SlotSide = 'HOME' | 'AWAY';
export type VerificationStatus = 'official' | 'seeded' | 'manual' | 'unknown';

export interface Team {
  id: string;
  name: string;
  code: string;
  flag: string;
  groupId?: string;
  verificationStatus?: VerificationStatus;
}

export interface Match {
  id: number;
  stage: Stage;
  groupId?: string;
  kickoffAt: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeSlot: string;
  awaySlot: string;
  verificationStatus?: VerificationStatus;
}

export interface TournamentMetadata {
  sourceName: string;
  sourceReference: string;
  sourceRetrievedAt: string;
  verificationStatus: VerificationStatus;
  notes?: string[];
}

export interface Scoreline {
  homeGoals: number;
  awayGoals: number;
}

export interface MatchPrediction extends Scoreline {
  matchId: number;
  penaltyWinner?: SlotSide;
}

export interface MatchResult extends Scoreline {
  matchId: number;
  penaltyWinner?: SlotSide;
  playedAt?: string;
}

export interface MatchScoreBreakdown {
  matchId: number;
  points: number;
  explanation: string;
}

export interface GroupBonusPrediction {
  groupId: string;
  winnerTeamId: string;
  secondTeamId: string;
  qualifierTeamIds: string[];
}

export interface GroupBonusResult extends GroupBonusPrediction {}

export interface KnockoutBonusPrediction {
  r16TeamIds: string[];
  qfTeamIds: string[];
  sfTeamIds: string[];
  finalTeamIds: string[];
  thirdPlaceWinnerTeamId: string;
  championTeamId: string;
  topScorer: string;
}

export interface KnockoutBonusResult extends KnockoutBonusPrediction {
  topScorers: string[];
}

export interface BonusScoreBreakdown {
  code: string;
  points: number;
  explanation: string;
}

export interface ParticipantScore {
  playerId: string;
  name: string;
  submittedAt: string;
  matchPoints: number;
  bonusPoints: number;
  totalPoints: number;
  previousRank?: number;
}
