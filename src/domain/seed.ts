import type { Match, Team } from './types.js';

const GROUPS = Array.from({ length: 12 }, (_, index) => String.fromCharCode(65 + index));

export function createTeams(): Team[] {
  const named = ['Canada', 'Mexico', 'United States'];
  return Array.from({ length: 48 }, (_, index) => {
    const number = index + 1;
    const groupId = GROUPS[Math.floor(index / 4)];
    return { id: `T${String(number).padStart(2, '0')}`, name: named[index] ?? `Country ${String(number).padStart(2, '0')}`, groupId };
  });
}

export function createMatches(teams = createTeams()): Match[] {
  const matches: Match[] = [];
  let id = 1;
  let day = 0;
  for (const groupId of GROUPS) {
    const groupTeams = teams.filter((team) => team.groupId === groupId);
    for (const [homeIndex, awayIndex] of [[0, 1], [2, 3], [0, 2], [3, 1], [3, 0], [1, 2]]) {
      const home = groupTeams[homeIndex];
      const away = groupTeams[awayIndex];
      matches.push({ id, stage: 'GROUP', groupId, kickoffAt: kickoff(day++), homeTeamId: home.id, awayTeamId: away.id, homeSlot: home.name, awaySlot: away.name });
      id++;
    }
  }
  for (const [stage, count] of [['R32', 16], ['R16', 8], ['QF', 4], ['SF', 2], ['THIRD_PLACE', 1], ['FINAL', 1]] as Array<[Match['stage'], number]>) {
    for (let index = 1; index <= count; index++) {
      matches.push({ id, stage, kickoffAt: kickoff(day++), homeSlot: `${stage} slot ${index}A`, awaySlot: `${stage} slot ${index}B` });
      id++;
    }
  }
  return matches;
}

function kickoff(dayOffset: number): string {
  return new Date(Date.UTC(2026, 5, 11 + dayOffset, 19, 0, 0)).toISOString();
}
