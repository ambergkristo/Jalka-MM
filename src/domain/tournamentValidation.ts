import type { Match, Team, TournamentMetadata, VerificationStatus } from './types.js';
import type { TournamentGroup } from './tournamentData.js';

export const allowedVerificationStatuses: VerificationStatus[] = ['official', 'partial_official', 'seeded', 'manual', 'unknown'];

export interface TournamentValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  counts: {
    teams: number;
    groups: number;
    matches: number;
    groupMatches: number;
    knockoutMatches: number;
  };
  unresolved: {
    teamSlots: number;
    fixtureDates: number;
    kickoffTimes: number;
    knockoutSlots: number;
    groupStageKickoffMatchIds: number[];
  };
  riskLevel: 'low' | 'medium' | 'high';
}

export function validateTournamentData(input: { metadata: TournamentMetadata; teams: Team[]; groups: TournamentGroup[]; matches: Match[] }): TournamentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const teamSeen = new Set<string>();
  const teamIds = new Set(input.teams.map((team) => team.id));
  const groupIds = new Set(input.groups.map((group) => group.id));
  const matchIds = new Set<number>();
  const groupMatches = input.matches.filter((match) => match.stage === 'GROUP');
  const knockoutMatches = input.matches.filter((match) => match.stage !== 'GROUP');
  const unresolved = { teamSlots: 0, fixtureDates: 0, kickoffTimes: 0, knockoutSlots: 0, groupStageKickoffMatchIds: [] as number[] };

  validateMetadata(input.metadata, errors);
  if (input.metadata.verificationStatus !== 'official') warnings.push(`Tournament data is ${input.metadata.verificationStatus}, not official`);
  if (input.teams.length !== 48) errors.push(`Expected 48 teams, found ${input.teams.length}`);
  if (input.groups.length !== 12) errors.push(`Expected 12 groups, found ${input.groups.length}`);
  if (input.matches.length !== 104) errors.push(`Expected 104 matches, found ${input.matches.length}`);
  if (groupMatches.length !== 72) errors.push(`Expected 72 group-stage matches, found ${groupMatches.length}`);
  if (knockoutMatches.length !== 32) errors.push(`Expected 32 knockout matches, found ${knockoutMatches.length}`);

  for (const team of input.teams) {
    if (teamSeen.has(team.id)) errors.push(`Duplicate team id ${team.id}`);
    teamSeen.add(team.id);
    if (team.groupId && !groupIds.has(team.groupId)) errors.push(`Team ${team.id} references invalid group ${team.groupId}`);
    if (team.verificationStatus && !allowedVerificationStatuses.includes(team.verificationStatus)) errors.push(`Team ${team.id} has invalid verificationStatus ${team.verificationStatus}`);
  }

  for (const group of input.groups) {
    const teamsInGroup = input.teams.filter((team) => team.groupId === group.id);
    if (teamsInGroup.length !== 4) errors.push(`Expected 4 teams in Group ${group.id}, found ${teamsInGroup.length}`);
  }

  for (const match of input.matches) {
    if (matchIds.has(match.id)) errors.push(`Duplicate match id ${match.id}`);
    matchIds.add(match.id);
    if (match.groupId && !groupIds.has(match.groupId)) errors.push(`Match ${match.id} references invalid group ${match.groupId}`);
    if (match.homeTeamId && !teamIds.has(match.homeTeamId)) errors.push(`Match ${match.id} references invalid home team ${match.homeTeamId}`);
    if (match.awayTeamId && !teamIds.has(match.awayTeamId)) errors.push(`Match ${match.id} references invalid away team ${match.awayTeamId}`);
    if (match.verificationStatus && !allowedVerificationStatuses.includes(match.verificationStatus)) errors.push(`Match ${match.id} has invalid verificationStatus ${match.verificationStatus}`);
    if (!isValidDateOrTbc(match.kickoffAt)) errors.push(`Match ${match.id} has invalid kickoffAt ${match.kickoffAt}`);
    if (match.kickoffAt === 'TBC') {
      unresolved.fixtureDates += 1;
      if (match.stage === 'GROUP') {
        unresolved.kickoffTimes += 1;
        unresolved.groupStageKickoffMatchIds.push(match.id);
      }
    }
    if (match.stage === 'GROUP' && (!match.homeTeamId || !match.awayTeamId)) unresolved.teamSlots += missingTeamSlots(match);
    if (match.stage !== 'GROUP') {
      if (match.homeTeamId || match.awayTeamId) errors.push(`Knockout match ${match.id} must use bracket slots instead of concrete team ids`);
      unresolved.knockoutSlots += missingTeamSlots(match);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    counts: {
      teams: input.teams.length,
      groups: input.groups.length,
      matches: input.matches.length,
      groupMatches: groupMatches.length,
      knockoutMatches: knockoutMatches.length
    },
    unresolved,
    riskLevel: riskLevelFor(input.metadata.verificationStatus)
  };
}

export function isValidDateOrTbc(value: string): boolean {
  return value === 'TBC' || (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(new Date(value).getTime()));
}

function validateMetadata(metadata: TournamentMetadata, errors: string[]): void {
  if (!metadata.sourceName) errors.push('metadata.sourceName is required');
  if (!metadata.sourceReference) errors.push('metadata.sourceReference is required');
  if (!metadata.sourceRetrievedAt || !isValidDateOrTbc(metadata.sourceRetrievedAt)) errors.push('metadata.sourceRetrievedAt must be a valid ISO timestamp');
  if (!metadata.verificationStatus) errors.push('metadata.verificationStatus is required');
  if (metadata.verificationStatus && !allowedVerificationStatuses.includes(metadata.verificationStatus)) errors.push(`metadata.verificationStatus ${metadata.verificationStatus} is not allowed`);
  if ((metadata.verificationStatus === 'official' || metadata.verificationStatus === 'partial_official') && (!metadata.sourceName || !metadata.sourceReference || !metadata.sourceRetrievedAt)) {
    errors.push(`${metadata.verificationStatus} data requires source metadata`);
  }
}

function missingTeamSlots(match: Match): number {
  return (match.homeTeamId ? 0 : 1) + (match.awayTeamId ? 0 : 1);
}

export function riskLevelFor(status: VerificationStatus): 'low' | 'medium' | 'high' {
  if (status === 'official') return 'low';
  if (status === 'partial_official') return 'medium';
  return 'high';
}
