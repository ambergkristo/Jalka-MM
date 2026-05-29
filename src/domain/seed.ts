import type { Match, Team } from './types.js';
import { createSeededTeams } from './teams.js';

const GROUPS = Array.from({ length: 12 }, (_, index) => String.fromCharCode(65 + index));

export function createTeams(): Team[] {
  return createSeededTeams();
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
  const knockoutSlots: Record<string, string[]> = {
    R32: ['Winner Group A', 'Runner-up Group B', 'Winner Group C', 'Runner-up Group D', 'Winner Group E', 'Runner-up Group F', 'Winner Group G', 'Runner-up Group H', 'Winner Group I', 'Runner-up Group J', 'Winner Group K', 'Runner-up Group L', 'Best third-place 1', 'Best third-place 2', 'Best third-place 3', 'Best third-place 4', 'Winner Group B', 'Runner-up Group A', 'Winner Group D', 'Runner-up Group C', 'Winner Group F', 'Runner-up Group E', 'Winner Group H', 'Runner-up Group G', 'Winner Group J', 'Runner-up Group I', 'Winner Group L', 'Runner-up Group K', 'Best third-place 5', 'Best third-place 6', 'Best third-place 7', 'Best third-place 8'],
    R16: Array.from({ length: 16 }, (_, index) => `Winner R32 Match ${73 + Math.floor(index / 2)}`),
    QF: Array.from({ length: 8 }, (_, index) => `Winner R16 Match ${89 + Math.floor(index / 2)}`),
    SF: Array.from({ length: 4 }, (_, index) => `Winner QF Match ${97 + Math.floor(index / 2)}`),
    THIRD_PLACE: ['Loser SF Match 101', 'Loser SF Match 102'],
    FINAL: ['Winner SF Match 101', 'Winner SF Match 102']
  };
  for (const [stage, count] of [['R32', 16], ['R16', 8], ['QF', 4], ['SF', 2], ['THIRD_PLACE', 1], ['FINAL', 1]] as Array<[Match['stage'], number]>) {
    for (let index = 1; index <= count; index++) {
      const slotIndex = (index - 1) * 2;
      matches.push({ id, stage, kickoffAt: kickoff(day++), homeSlot: knockoutSlots[stage][slotIndex], awaySlot: knockoutSlots[stage][slotIndex + 1] });
      id++;
    }
  }
  return matches;
}

function kickoff(dayOffset: number): string {
  return new Date(Date.UTC(2026, 5, 11 + dayOffset, 19, 0, 0)).toISOString();
}
