import type { Match, Team, TournamentMetadata } from './types.js';
import type { TournamentGroup } from './tournamentData.js';
import { validateTournamentData } from './tournamentValidation.js';

export interface TournamentAuditReport {
  verificationStatus: string;
  sourceName: string;
  sourceReference: string;
  sourceRetrievedAt: string;
  teamCount: number;
  groupCount: number;
  matchCount: number;
  groupStageMatchCount: number;
  knockoutMatchCount: number;
  unresolvedTeamSlots: number;
  unresolvedFixtureDates: number;
  unresolvedKickoffTimes: number;
  unresolvedGroupStageKickoffMatchIds: number[];
  unresolvedKnockoutSlots: number;
  valid: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  warnings: string[];
  errors: string[];
}

export function createTournamentAuditReport(input: { metadata: TournamentMetadata; teams: Team[]; groups: TournamentGroup[]; matches: Match[] }): TournamentAuditReport {
  const validation = validateTournamentData(input);
  return {
    verificationStatus: input.metadata.verificationStatus,
    sourceName: input.metadata.sourceName,
    sourceReference: input.metadata.sourceReference,
    sourceRetrievedAt: input.metadata.sourceRetrievedAt,
    teamCount: validation.counts.teams,
    groupCount: validation.counts.groups,
    matchCount: validation.counts.matches,
    groupStageMatchCount: validation.counts.groupMatches,
    knockoutMatchCount: validation.counts.knockoutMatches,
    unresolvedTeamSlots: validation.unresolved.teamSlots,
    unresolvedFixtureDates: validation.unresolved.fixtureDates,
    unresolvedKickoffTimes: validation.unresolved.kickoffTimes,
    unresolvedGroupStageKickoffMatchIds: validation.unresolved.groupStageKickoffMatchIds,
    unresolvedKnockoutSlots: validation.unresolved.knockoutSlots,
    valid: validation.valid,
    riskLevel: validation.riskLevel,
    warnings: validation.warnings,
    errors: validation.errors
  };
}
