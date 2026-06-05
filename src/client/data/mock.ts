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

export interface LeaderboardRow {
  rank: number;
  playerId: string;
  player: string;
  points: number;
  exactScores: number;
  hitRate: string;
}

export interface GroupLeader {
  group: string;
  team: string;
  points: number;
  record: string;
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

export const leaderboardPreview: LeaderboardRow[] = [
  { rank: 1, playerId: 'kristo', player: 'Kristo', points: 124, exactScores: 8, hitRate: '68%' },
  { rank: 2, playerId: 'argo', player: 'Argo', points: 118, exactScores: 7, hitRate: '64%' },
  { rank: 3, playerId: 'mari', player: 'Mari', points: 111, exactScores: 6, hitRate: '61%' },
  { rank: 4, playerId: 'taavi', player: 'Taavi', points: 104, exactScores: 5, hitRate: '58%' },
  { rank: 5, playerId: 'liis', player: 'Liis', points: 99, exactScores: 5, hitRate: '55%' }
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

export const topScorers = [
  { rank: 1, player: 'Player One', team: 'TBD', goals: 5 },
  { rank: 2, player: 'Player Two', team: 'TBD', goals: 4 },
  { rank: 3, player: 'Player Three', team: 'TBD', goals: 4 }
];

export const matchRows = todaysMatches.map((match) => ({
  time: match.kickoffTime,
  home: match.homeTeam,
  away: match.awayTeam,
  status: match.status
}));
