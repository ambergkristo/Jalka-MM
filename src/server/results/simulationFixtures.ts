export interface SimulationGoalEvent {
  matchId: number;
  playerName: string;
  teamId: string;
  goals: number;
}

export interface SimulationMatchResult {
  matchId: number;
  homeScore: number;
  awayScore: number;
  minute: number;
  goals: SimulationGoalEvent[];
}

export const MATCHDAY1_SIMULATION_RESULTS: SimulationMatchResult[] = [
  {
    matchId: 1,
    homeScore: 2,
    awayScore: 1,
    minute: 90,
    goals: [
      { matchId: 1, playerName: 'Santiago Gimenez', teamId: 'A1', goals: 1 },
      { matchId: 1, playerName: 'Edson Alvarez', teamId: 'A1', goals: 1 },
      { matchId: 1, playerName: 'Percy Tau', teamId: 'A2', goals: 1 }
    ]
  },
  {
    matchId: 2,
    homeScore: 1,
    awayScore: 1,
    minute: 90,
    goals: [
      { matchId: 2, playerName: 'Son Heung-min', teamId: 'A3', goals: 1 },
      { matchId: 2, playerName: 'Patrik Schick', teamId: 'A4', goals: 1 }
    ]
  },
  {
    matchId: 3,
    homeScore: 2,
    awayScore: 0,
    minute: 90,
    goals: [
      { matchId: 3, playerName: 'Jonathan David', teamId: 'B1', goals: 1 },
      { matchId: 3, playerName: 'Alphonso Davies', teamId: 'B1', goals: 1 }
    ]
  }
];

export const MATCHDAY1_SIMULATION_MATCH_IDS = MATCHDAY1_SIMULATION_RESULTS.map((result) => result.matchId);
