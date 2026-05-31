import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const allowedVerificationStatuses = ['official', 'partial_official', 'seeded', 'manual', 'unknown'];

export function readTournamentData(root = process.cwd()) {
  const dataDir = join(root, 'src', 'data', 'worldcup2026');
  const readJson = (name) => JSON.parse(readFileSync(join(dataDir, name), 'utf8'));
  return {
    metadata: readJson('metadata.json'),
    teams: readJson('teams.json'),
    groups: readJson('groups.json'),
    matches: readJson('matches.json'),
    bracket: readJson('bracket.json')
  };
}

export function validateTournamentData({ metadata, teams, groups, matches }) {
  const errors = [];
  const warnings = [];
  const teamSeen = new Set();
  const teamIds = new Set(teams.map((team) => team.id));
  const groupIds = new Set(groups.map((group) => group.id));
  const matchIds = new Set();
  const groupMatches = matches.filter((match) => match.stage === 'GROUP');
  const knockoutMatches = matches.filter((match) => match.stage !== 'GROUP');
  const unresolved = { teamSlots: 0, fixtureDates: 0, kickoffTimes: 0, knockoutSlots: 0, groupStageKickoffMatchIds: [] };

  if (!metadata.sourceName) errors.push('metadata.sourceName is required');
  if (!metadata.sourceReference) errors.push('metadata.sourceReference is required');
  if (!metadata.sourceRetrievedAt || !isValidDateOrTbc(metadata.sourceRetrievedAt)) errors.push('metadata.sourceRetrievedAt must be a valid ISO timestamp');
  if (!metadata.verificationStatus) errors.push('metadata.verificationStatus is required');
  if (metadata.verificationStatus && !allowedVerificationStatuses.includes(metadata.verificationStatus)) errors.push(`metadata.verificationStatus ${metadata.verificationStatus} is not allowed`);
  if (metadata.verificationStatus !== 'official') warnings.push(`Tournament data is ${metadata.verificationStatus}, not official`);

  if (teams.length !== 48) errors.push(`Expected 48 teams, found ${teams.length}`);
  if (groups.length !== 12) errors.push(`Expected 12 groups, found ${groups.length}`);
  if (matches.length !== 104) errors.push(`Expected 104 matches, found ${matches.length}`);
  if (groupMatches.length !== 72) errors.push(`Expected 72 group-stage matches, found ${groupMatches.length}`);
  if (knockoutMatches.length !== 32) errors.push(`Expected 32 knockout matches, found ${knockoutMatches.length}`);

  for (const team of teams) {
    if (teamSeen.has(team.id)) errors.push(`Duplicate team id ${team.id}`);
    teamSeen.add(team.id);
    if (team.groupId && !groupIds.has(team.groupId)) errors.push(`Team ${team.id} references invalid group ${team.groupId}`);
    if (team.verificationStatus && !allowedVerificationStatuses.includes(team.verificationStatus)) errors.push(`Team ${team.id} has invalid verificationStatus ${team.verificationStatus}`);
    if (!hasValidConcreteFlag(team)) errors.push(`Team ${team.id} has invalid or corrupted flag value`);
  }

  for (const group of groups) {
    const teamsInGroup = teams.filter((team) => team.groupId === group.id);
    if (teamsInGroup.length !== 4) errors.push(`Expected 4 teams in Group ${group.id}, found ${teamsInGroup.length}`);
  }

  for (const match of matches) {
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
    counts: { teams: teams.length, groups: groups.length, matches: matches.length, groupMatches: groupMatches.length, knockoutMatches: knockoutMatches.length },
    unresolved,
    riskLevel: riskLevelFor(metadata.verificationStatus)
  };
}

export function createAuditReport(data) {
  const validation = validateTournamentData(data);
  return {
    verificationStatus: data.metadata.verificationStatus,
    sourceName: data.metadata.sourceName,
    sourceReference: data.metadata.sourceReference,
    sourceRetrievedAt: data.metadata.sourceRetrievedAt,
    teamCount: validation.counts.teams,
    groupCount: validation.counts.groups,
    matchCount: validation.counts.matches,
    groupStageMatchCount: validation.counts.groupMatches,
    knockoutMatchCount: validation.counts.knockoutMatches,
    unresolvedTeamSlots: validation.unresolved.teamSlots,
    unresolvedFixtureDates: validation.unresolved.fixtureDates,
    unresolvedKickoffTimes: validation.unresolved.kickoffTimes,
    verifiedGroupStageKickoffTimes: validation.counts.groupMatches - validation.unresolved.kickoffTimes,
    unresolvedGroupStageKickoffMatchIds: validation.unresolved.groupStageKickoffMatchIds,
    unresolvedKnockoutSlots: validation.unresolved.knockoutSlots,
    valid: validation.valid,
    riskLevel: validation.riskLevel,
    warnings: validation.warnings,
    errors: validation.errors
  };
}

export function isValidDateOrTbc(value) {
  return value === 'TBC' || (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(new Date(value).getTime()));
}

function missingTeamSlots(match) {
  return (match.homeTeamId ? 0 : 1) + (match.awayTeamId ? 0 : 1);
}

function riskLevelFor(status) {
  if (status === 'official') return 'low';
  if (status === 'partial_official') return 'medium';
  return 'high';
}

function hasValidConcreteFlag(team) {
  if (!team.groupId) return true;
  return typeof team.flag === 'string' && team.flag.trim() !== '' && !team.flag.includes('?') && !team.flag.includes('�');
}
