import type { Match, Team } from './types.js';
import { getTournamentData } from './tournamentData.js';

export function createTeams(): Team[] {
  return getTournamentData().teams;
}

export function createMatches(): Match[] {
  return getTournamentData().matches;
}
