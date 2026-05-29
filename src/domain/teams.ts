import type { Team } from './types.js';
import { getTournamentData } from './tournamentData.js';

export function createSeededTeams(): Team[] {
  return getTournamentData().teams;
}
