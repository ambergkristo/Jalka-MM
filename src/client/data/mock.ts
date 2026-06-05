export interface DashboardMetric {
  label: string;
  value: string;
  detail: string;
}

export interface DashboardMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  stage: string;
  status: 'scheduled' | 'live' | 'final';
  venue: string;
}

export interface DashboardResult {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  stage: string;
  winner: string;
  finishedAt: string;
}

export interface GroupLeader {
  group: string;
  team: string;
  points: number;
  record: string;
}

export interface TournamentSummaryMetric {
  label: string;
  value: string;
  detail: string;
  tone: 'gold' | 'blue' | 'green' | 'red';
}

export type QualificationState = 'qualified' | 'third-place' | 'at-risk' | 'out';

export interface GroupStandingTeam {
  rank: number;
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  state: QualificationState;
}

export interface GroupStanding {
  group: string;
  teams: GroupStandingTeam[];
}

export interface KnockoutMatch {
  id: string;
  label: string;
  teamOne: string;
  teamTwo: string;
  teamOneScore?: number;
  teamTwoScore?: number;
  status: 'Scheduled' | 'Live' | 'Full-time' | 'Extra time' | 'Penalties';
  kickoffTime?: string;
  winner?: string;
}

export interface KnockoutStageData {
  stage: 'R32' | 'R16' | 'QF' | 'SF' | 'Final';
  title: string;
  matches: KnockoutMatch[];
}

export interface TournamentTopScorer {
  rank: number;
  player: string;
  team: string;
  goals: number;
  assists: number;
}

export interface TournamentStat {
  label: string;
  value: string;
  detail: string;
}

export interface NavigationCardData {
  title: string;
  description: string;
  href: string;
  accent: 'gold' | 'blue' | 'green';
}

export const heroMetrics: DashboardMetric[] = [
  { label: 'Tournament phase', value: 'Group stage', detail: 'Matchday 2 in progress' },
  { label: 'Completed', value: '18 / 104', detail: '17% of matches played' },
  { label: 'Remaining', value: '86', detail: 'Next kickoff in 2h 15m' }
];

export const todaysMatches: DashboardMatch[] = [
  { id: 'm19', homeTeam: 'Canada', awayTeam: 'Morocco', kickoffTime: '19:00', stage: 'Group B', status: 'scheduled', venue: 'Toronto' },
  { id: 'm20', homeTeam: 'Mexico', awayTeam: 'Japan', kickoffTime: '22:00', stage: 'Group A', status: 'scheduled', venue: 'Mexico City' },
  { id: 'm21', homeTeam: 'United States', awayTeam: 'Ghana', kickoffTime: '02:00', stage: 'Group D', status: 'scheduled', venue: 'Los Angeles' }
];

export const latestResults: DashboardResult[] = [
  { id: 'r16', homeTeam: 'Brazil', awayTeam: 'Croatia', homeScore: 2, awayScore: 1, stage: 'Group C', winner: 'Brazil', finishedAt: 'FT' },
  { id: 'r17', homeTeam: 'Spain', awayTeam: 'Senegal', homeScore: 1, awayScore: 1, stage: 'Group H', winner: 'Draw', finishedAt: 'FT' },
  { id: 'r18', homeTeam: 'Argentina', awayTeam: 'Korea Republic', homeScore: 3, awayScore: 0, stage: 'Group F', winner: 'Argentina', finishedAt: 'FT' }
];

export const groupLeaders: GroupLeader[] = [
  { group: 'A', team: 'Mexico', points: 6, record: '2W 0D 0L' },
  { group: 'B', team: 'Canada', points: 4, record: '1W 1D 0L' },
  { group: 'C', team: 'Brazil', points: 6, record: '2W 0D 0L' },
  { group: 'D', team: 'United States', points: 4, record: '1W 1D 0L' },
  { group: 'E', team: 'Germany', points: 6, record: '2W 0D 0L' },
  { group: 'F', team: 'Argentina', points: 6, record: '2W 0D 0L' },
  { group: 'G', team: 'France', points: 4, record: '1W 1D 0L' },
  { group: 'H', team: 'Spain', points: 5, record: '1W 2D 0L' },
  { group: 'I', team: 'England', points: 6, record: '2W 0D 0L' },
  { group: 'J', team: 'Portugal', points: 4, record: '1W 1D 0L' },
  { group: 'K', team: 'Netherlands', points: 6, record: '2W 0D 0L' },
  { group: 'L', team: 'Uruguay', points: 4, record: '1W 1D 0L' }
];

export const navigationCards: NavigationCardData[] = [
  { title: 'Results', description: 'Scores, statuses, and match timeline', href: '/results', accent: 'blue' },
  { title: 'Leaderboard', description: 'Prediction league rank and points', href: '/leaderboard', accent: 'gold' },
  { title: 'Tournament', description: 'Groups, bracket, top scorers, stats', href: '/tournament', accent: 'green' }
];

export const tournamentSummary: TournamentSummaryMetric[] = [
  { label: 'Current phase', value: 'Group Stage', detail: 'Matchday 2 across Groups A-L', tone: 'gold' },
  { label: 'Matches completed', value: '18 / 104', detail: '86 fixtures still to play', tone: 'blue' },
  { label: 'Goals scored', value: '52', detail: '2.89 goals per match', tone: 'green' },
  { label: 'Remaining teams', value: '48', detail: '24 direct qualification spots in play', tone: 'red' }
];

type StandingInput = Omit<GroupStandingTeam, 'goalDifference' | 'state'> & { state?: QualificationState };

function standing(row: StandingInput): GroupStandingTeam {
  return {
    ...row,
    goalDifference: row.goalsFor - row.goalsAgainst,
    state: row.state ?? (row.rank <= 2 ? 'qualified' : row.rank === 3 ? 'third-place' : 'at-risk')
  };
}

export const groupStandings: GroupStanding[] = [
  {
    group: 'A',
    teams: [
      standing({ rank: 1, team: 'Mexico', played: 2, wins: 2, draws: 0, losses: 0, goalsFor: 5, goalsAgainst: 1, points: 6 }),
      standing({ rank: 2, team: 'Japan', played: 2, wins: 1, draws: 1, losses: 0, goalsFor: 3, goalsAgainst: 1, points: 4 }),
      standing({ rank: 3, team: 'Morocco', played: 2, wins: 0, draws: 1, losses: 1, goalsFor: 1, goalsAgainst: 3, points: 1 }),
      standing({ rank: 4, team: 'New Zealand', played: 2, wins: 0, draws: 0, losses: 2, goalsFor: 0, goalsAgainst: 4, points: 0, state: 'out' })
    ]
  },
  {
    group: 'B',
    teams: [
      standing({ rank: 1, team: 'Canada', played: 2, wins: 1, draws: 1, losses: 0, goalsFor: 4, goalsAgainst: 2, points: 4 }),
      standing({ rank: 2, team: 'Switzerland', played: 2, wins: 1, draws: 1, losses: 0, goalsFor: 2, goalsAgainst: 1, points: 4 }),
      standing({ rank: 3, team: 'Chile', played: 2, wins: 1, draws: 0, losses: 1, goalsFor: 2, goalsAgainst: 2, points: 3 }),
      standing({ rank: 4, team: 'Tunisia', played: 2, wins: 0, draws: 0, losses: 2, goalsFor: 1, goalsAgainst: 4, points: 0, state: 'at-risk' })
    ]
  },
  {
    group: 'C',
    teams: [
      standing({ rank: 1, team: 'Brazil', played: 2, wins: 2, draws: 0, losses: 0, goalsFor: 6, goalsAgainst: 2, points: 6 }),
      standing({ rank: 2, team: 'Croatia', played: 2, wins: 1, draws: 0, losses: 1, goalsFor: 3, goalsAgainst: 3, points: 3 }),
      standing({ rank: 3, team: 'Egypt', played: 2, wins: 1, draws: 0, losses: 1, goalsFor: 2, goalsAgainst: 2, points: 3 }),
      standing({ rank: 4, team: 'Panama', played: 2, wins: 0, draws: 0, losses: 2, goalsFor: 1, goalsAgainst: 5, points: 0, state: 'out' })
    ]
  },
  {
    group: 'D',
    teams: [
      standing({ rank: 1, team: 'United States', played: 2, wins: 1, draws: 1, losses: 0, goalsFor: 5, goalsAgainst: 2, points: 4 }),
      standing({ rank: 2, team: 'Ghana', played: 2, wins: 1, draws: 1, losses: 0, goalsFor: 4, goalsAgainst: 3, points: 4 }),
      standing({ rank: 3, team: 'Norway', played: 2, wins: 1, draws: 0, losses: 1, goalsFor: 3, goalsAgainst: 3, points: 3 }),
      standing({ rank: 4, team: 'Iraq', played: 2, wins: 0, draws: 0, losses: 2, goalsFor: 1, goalsAgainst: 5, points: 0, state: 'at-risk' })
    ]
  },
  {
    group: 'E',
    teams: [
      standing({ rank: 1, team: 'Germany', played: 2, wins: 2, draws: 0, losses: 0, goalsFor: 4, goalsAgainst: 0, points: 6 }),
      standing({ rank: 2, team: 'Colombia', played: 2, wins: 1, draws: 0, losses: 1, goalsFor: 3, goalsAgainst: 2, points: 3 }),
      standing({ rank: 3, team: 'Australia', played: 2, wins: 1, draws: 0, losses: 1, goalsFor: 2, goalsAgainst: 3, points: 3 }),
      standing({ rank: 4, team: 'Jamaica', played: 2, wins: 0, draws: 0, losses: 2, goalsFor: 0, goalsAgainst: 4, points: 0, state: 'out' })
    ]
  },
  {
    group: 'F',
    teams: [
      standing({ rank: 1, team: 'Argentina', played: 2, wins: 2, draws: 0, losses: 0, goalsFor: 7, goalsAgainst: 1, points: 6 }),
      standing({ rank: 2, team: 'Korea Republic', played: 2, wins: 1, draws: 0, losses: 1, goalsFor: 3, goalsAgainst: 3, points: 3 }),
      standing({ rank: 3, team: 'Austria', played: 2, wins: 1, draws: 0, losses: 1, goalsFor: 2, goalsAgainst: 3, points: 3 }),
      standing({ rank: 4, team: 'Cameroon', played: 2, wins: 0, draws: 0, losses: 2, goalsFor: 1, goalsAgainst: 6, points: 0, state: 'at-risk' })
    ]
  },
  {
    group: 'G',
    teams: [
      standing({ rank: 1, team: 'France', played: 2, wins: 1, draws: 1, losses: 0, goalsFor: 4, goalsAgainst: 1, points: 4 }),
      standing({ rank: 2, team: 'Denmark', played: 2, wins: 1, draws: 1, losses: 0, goalsFor: 3, goalsAgainst: 1, points: 4 }),
      standing({ rank: 3, team: 'Costa Rica', played: 2, wins: 0, draws: 2, losses: 0, goalsFor: 2, goalsAgainst: 2, points: 2 }),
      standing({ rank: 4, team: 'UAE', played: 2, wins: 0, draws: 0, losses: 2, goalsFor: 0, goalsAgainst: 5, points: 0, state: 'at-risk' })
    ]
  },
  {
    group: 'H',
    teams: [
      standing({ rank: 1, team: 'Spain', played: 3, wins: 1, draws: 2, losses: 0, goalsFor: 5, goalsAgainst: 2, points: 5 }),
      standing({ rank: 2, team: 'Senegal', played: 3, wins: 1, draws: 2, losses: 0, goalsFor: 4, goalsAgainst: 3, points: 5 }),
      standing({ rank: 3, team: 'Iran', played: 3, wins: 1, draws: 0, losses: 2, goalsFor: 3, goalsAgainst: 5, points: 3 }),
      standing({ rank: 4, team: 'Honduras', played: 3, wins: 0, draws: 2, losses: 1, goalsFor: 2, goalsAgainst: 4, points: 2, state: 'out' })
    ]
  },
  {
    group: 'I',
    teams: [
      standing({ rank: 1, team: 'England', played: 2, wins: 2, draws: 0, losses: 0, goalsFor: 5, goalsAgainst: 1, points: 6 }),
      standing({ rank: 2, team: 'Serbia', played: 2, wins: 1, draws: 0, losses: 1, goalsFor: 3, goalsAgainst: 2, points: 3 }),
      standing({ rank: 3, team: 'Qatar', played: 2, wins: 1, draws: 0, losses: 1, goalsFor: 2, goalsAgainst: 3, points: 3 }),
      standing({ rank: 4, team: 'Bolivia', played: 2, wins: 0, draws: 0, losses: 2, goalsFor: 1, goalsAgainst: 5, points: 0, state: 'out' })
    ]
  },
  {
    group: 'J',
    teams: [
      standing({ rank: 1, team: 'Portugal', played: 2, wins: 1, draws: 1, losses: 0, goalsFor: 5, goalsAgainst: 2, points: 4 }),
      standing({ rank: 2, team: 'Uruguay', played: 2, wins: 1, draws: 1, losses: 0, goalsFor: 3, goalsAgainst: 1, points: 4 }),
      standing({ rank: 3, team: 'South Africa', played: 2, wins: 0, draws: 1, losses: 1, goalsFor: 2, goalsAgainst: 4, points: 1 }),
      standing({ rank: 4, team: 'Saudi Arabia', played: 2, wins: 0, draws: 1, losses: 1, goalsFor: 1, goalsAgainst: 4, points: 1, state: 'at-risk' })
    ]
  },
  {
    group: 'K',
    teams: [
      standing({ rank: 1, team: 'Netherlands', played: 2, wins: 2, draws: 0, losses: 0, goalsFor: 4, goalsAgainst: 1, points: 6 }),
      standing({ rank: 2, team: 'Poland', played: 2, wins: 1, draws: 0, losses: 1, goalsFor: 3, goalsAgainst: 2, points: 3 }),
      standing({ rank: 3, team: 'Paraguay', played: 2, wins: 1, draws: 0, losses: 1, goalsFor: 2, goalsAgainst: 2, points: 3 }),
      standing({ rank: 4, team: 'Jordan', played: 2, wins: 0, draws: 0, losses: 2, goalsFor: 0, goalsAgainst: 4, points: 0, state: 'out' })
    ]
  },
  {
    group: 'L',
    teams: [
      standing({ rank: 1, team: 'Belgium', played: 2, wins: 1, draws: 1, losses: 0, goalsFor: 4, goalsAgainst: 2, points: 4 }),
      standing({ rank: 2, team: 'Ecuador', played: 2, wins: 1, draws: 1, losses: 0, goalsFor: 3, goalsAgainst: 2, points: 4 }),
      standing({ rank: 3, team: 'Mali', played: 2, wins: 1, draws: 0, losses: 1, goalsFor: 2, goalsAgainst: 2, points: 3 }),
      standing({ rank: 4, team: 'Scotland', played: 2, wins: 0, draws: 0, losses: 2, goalsFor: 1, goalsAgainst: 4, points: 0, state: 'at-risk' })
    ]
  }
];

export const knockoutStages: KnockoutStageData[] = [
  {
    stage: 'R32',
    title: 'Round of 32',
    matches: [
      { id: 'r32-1', label: 'R32-1', teamOne: 'Mexico', teamTwo: 'Chile', teamOneScore: 2, teamTwoScore: 1, status: 'Full-time', winner: 'Mexico' },
      { id: 'r32-2', label: 'R32-2', teamOne: 'Brazil', teamTwo: 'Norway', teamOneScore: 3, teamTwoScore: 0, status: 'Full-time', winner: 'Brazil' },
      { id: 'r32-3', label: 'R32-3', teamOne: 'Germany', teamTwo: 'Austria', status: 'Scheduled', kickoffTime: 'Jun 29, 20:00' },
      { id: 'r32-4', label: 'R32-4', teamOne: 'France', teamTwo: 'Iran', status: 'Scheduled', kickoffTime: 'Jun 30, 23:00' }
    ]
  },
  {
    stage: 'R16',
    title: 'Round of 16',
    matches: [
      { id: 'r16-1', label: 'R16-1', teamOne: 'Mexico', teamTwo: 'Brazil', status: 'Scheduled', kickoffTime: 'Jul 4, 21:00' },
      { id: 'r16-2', label: 'R16-2', teamOne: 'Canada', teamTwo: 'Argentina', status: 'Scheduled', kickoffTime: 'Jul 5, 02:00' },
      { id: 'r16-3', label: 'R16-3', teamOne: 'England', teamTwo: 'Uruguay', status: 'Scheduled', kickoffTime: 'Jul 5, 21:00' }
    ]
  },
  {
    stage: 'QF',
    title: 'Quarter-finals',
    matches: [
      { id: 'qf-1', label: 'QF-1', teamOne: 'Winner R16-1', teamTwo: 'Winner R16-2', status: 'Scheduled', kickoffTime: 'Jul 9, 22:00' },
      { id: 'qf-2', label: 'QF-2', teamOne: 'Winner R16-3', teamTwo: 'Spain', status: 'Scheduled', kickoffTime: 'Jul 10, 02:00' }
    ]
  },
  {
    stage: 'SF',
    title: 'Semi-finals',
    matches: [
      { id: 'sf-1', label: 'SF-1', teamOne: 'Winner QF-1', teamTwo: 'Winner QF-2', status: 'Scheduled', kickoffTime: 'Jul 14, 22:00' },
      { id: 'sf-2', label: 'SF-2', teamOne: 'France', teamTwo: 'Portugal', status: 'Scheduled', kickoffTime: 'Jul 15, 22:00' }
    ]
  },
  {
    stage: 'Final',
    title: 'Final',
    matches: [
      { id: 'final-1', label: 'Final', teamOne: 'Winner SF-1', teamTwo: 'Winner SF-2', status: 'Scheduled', kickoffTime: 'Jul 19, 22:00' }
    ]
  }
];

export const tournamentTopScorers: TournamentTopScorer[] = [
  { rank: 1, player: 'Kylian Mbappe', team: 'France', goals: 5, assists: 2 },
  { rank: 2, player: 'Julian Alvarez', team: 'Argentina', goals: 4, assists: 1 },
  { rank: 3, player: 'Vinicius Junior', team: 'Brazil', goals: 4, assists: 1 },
  { rank: 4, player: 'Harry Kane', team: 'England', goals: 3, assists: 2 },
  { rank: 5, player: 'Lamine Yamal', team: 'Spain', goals: 3, assists: 2 },
  { rank: 6, player: 'Cody Gakpo', team: 'Netherlands', goals: 3, assists: 1 },
  { rank: 7, player: 'Rafael Leao', team: 'Portugal', goals: 2, assists: 3 },
  { rank: 8, player: 'Jonathan David', team: 'Canada', goals: 2, assists: 1 }
];

export const tournamentStats: TournamentStat[] = [
  { label: 'Total goals', value: '52', detail: 'Through 18 completed matches' },
  { label: 'Average goals', value: '2.89', detail: 'Per completed match' },
  { label: 'Clean sheets', value: '7', detail: 'Germany and Brazil both have one' },
  { label: 'Biggest win', value: 'Argentina 3-0', detail: 'Against Korea Republic' },
  { label: 'Highest scoring', value: 'USA 3-2 Ghana', detail: 'Five-goal group match' }
];

export const topScorers = tournamentTopScorers.slice(0, 3).map(({ rank, player, team, goals }) => ({
  rank,
  player,
  team,
  goals
}));

export const tournamentProgressByStage = [
  { stage: 'Group stage', completed: 18, total: 72 },
  { stage: 'Round of 32', completed: 2, total: 16 },
  { stage: 'Round of 16', completed: 0, total: 8 },
  { stage: 'Quarter-finals', completed: 0, total: 4 },
  { stage: 'Semi-finals', completed: 0, total: 2 },
  { stage: 'Finals', completed: 0, total: 2 }
];

export const matchRows = todaysMatches.map((match) => ({
  time: match.kickoffTime,
  home: match.homeTeam,
  away: match.awayTeam,
  status: match.status
}));
