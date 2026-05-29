import type { Match, MatchResult, Team } from './types.js';

export interface GroupStanding {
  teamId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export function calculateGroupStandings(groupId: string, teams: Team[], matches: Match[], results: MatchResult[]): GroupStanding[] {
  const resultByMatch = new Map(results.map((result) => [result.matchId, result]));
  const standings = new Map<string, GroupStanding>();
  for (const team of teams.filter((team) => team.groupId === groupId)) standings.set(team.id, emptyStanding(team.id));

  for (const match of matches.filter((match) => match.stage === 'GROUP' && match.groupId === groupId)) {
    if (!match.homeTeamId || !match.awayTeamId) continue;
    const result = resultByMatch.get(match.id);
    if (!result) continue;
    applyResult(standings.get(match.homeTeamId)!, result.homeGoals, result.awayGoals);
    applyResult(standings.get(match.awayTeamId)!, result.awayGoals, result.homeGoals);
  }

  return [...standings.values()].sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);
}

function emptyStanding(teamId: string): GroupStanding {
  return { teamId, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 };
}

function applyResult(standing: GroupStanding, goalsFor: number, goalsAgainst: number) {
  standing.played += 1;
  standing.goalsFor += goalsFor;
  standing.goalsAgainst += goalsAgainst;
  standing.goalDifference = standing.goalsFor - standing.goalsAgainst;
  if (goalsFor > goalsAgainst) {
    standing.wins += 1;
    standing.points += 3;
  } else if (goalsFor === goalsAgainst) {
    standing.draws += 1;
    standing.points += 1;
  } else {
    standing.losses += 1;
  }
}
