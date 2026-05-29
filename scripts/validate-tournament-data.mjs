import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const dataDir = join(root, 'src', 'data', 'worldcup2026');
const readJson = (name) => JSON.parse(readFileSync(join(dataDir, name), 'utf8'));

const metadata = readJson('metadata.json');
const teams = readJson('teams.json');
const groups = readJson('groups.json');
const matches = readJson('matches.json');
const errors = [];
const warnings = [];
const teamIds = new Set(teams.map((team) => team.id));
const groupIds = new Set(groups.map((group) => group.id));
const matchIds = new Set();
const groupMatches = matches.filter((match) => match.stage === 'GROUP');
const knockoutMatches = matches.filter((match) => match.stage !== 'GROUP');

if (!metadata.verificationStatus) errors.push('metadata.verificationStatus is required');
if (metadata.verificationStatus !== 'official') warnings.push(`Tournament data is ${metadata.verificationStatus}, not official`);
if (teams.length !== 48) errors.push(`Expected 48 teams, found ${teams.length}`);
if (groups.length !== 12) errors.push(`Expected 12 groups, found ${groups.length}`);
if (matches.length !== 104) errors.push(`Expected 104 matches, found ${matches.length}`);
if (groupMatches.length !== 72) errors.push(`Expected 72 group-stage matches, found ${groupMatches.length}`);
if (knockoutMatches.length !== 32) errors.push(`Expected 32 knockout matches, found ${knockoutMatches.length}`);

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
  if (match.kickoffAt !== 'TBC' && Number.isNaN(new Date(match.kickoffAt).getTime())) errors.push(`Match ${match.id} has invalid kickoffAt ${match.kickoffAt}`);
}

for (const warning of warnings) console.warn(`Warning: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`Error: ${error}`);
  process.exit(1);
}

console.log(JSON.stringify({
  valid: true,
  verificationStatus: metadata.verificationStatus,
  counts: { teams: teams.length, groups: groups.length, matches: matches.length, groupMatches: groupMatches.length, knockoutMatches: knockoutMatches.length }
}, null, 2));
