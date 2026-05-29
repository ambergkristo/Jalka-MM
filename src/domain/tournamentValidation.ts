import type { Match, Team, TournamentMetadata } from './types.js';
import type { TournamentGroup } from './tournamentData.js';

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
}

export function validateTournamentData(input: { metadata: TournamentMetadata; teams: Team[]; groups: TournamentGroup[]; matches: Match[] }): TournamentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const teamIds = new Set(input.teams.map((team) => team.id));
  const groupIds = new Set(input.groups.map((group) => group.id));
  const matchIds = new Set<number>();
  const groupMatches = input.matches.filter((match) => match.stage === 'GROUP');
  const knockoutMatches = input.matches.filter((match) => match.stage !== 'GROUP');

  if (!input.metadata.verificationStatus) errors.push('metadata.verificationStatus is required');
  if (input.metadata.verificationStatus !== 'official') warnings.push(`Tournament data is ${input.metadata.verificationStatus}, not official`);
  if (input.teams.length !== 48) errors.push(`Expected 48 teams, found ${input.teams.length}`);
  if (input.groups.length !== 12) errors.push(`Expected 12 groups, found ${input.groups.length}`);
  if (input.matches.length !== 104) errors.push(`Expected 104 matches, found ${input.matches.length}`);
  if (groupMatches.length !== 72) errors.push(`Expected 72 group-stage matches, found ${groupMatches.length}`);
  if (knockoutMatches.length !== 32) errors.push(`Expected 32 knockout matches, found ${knockoutMatches.length}`);

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
    if (!isValidDateOrTbc(match.kickoffAt)) errors.push(`Match ${match.id} has invalid kickoffAt ${match.kickoffAt}`);
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
    }
  };
}

export function isValidDateOrTbc(value: string): boolean {
  return value === 'TBC' || !Number.isNaN(new Date(value).getTime());
}
