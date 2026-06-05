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
  correctResults: number;
  hitRate: string;
  positionChange: number;
}

export type PredictionStatus = 'Still alive' | 'Eliminated' | 'Won Tournament';

export interface TopScorerPrediction {
  name: string;
  team: string;
  currentGoals: number;
  status: 'Leading' | 'In chase' | 'Eliminated';
}

export interface KnockoutRoundPrediction {
  round: 'R32' | 'R16' | 'QF' | 'SF' | 'Final';
  teams: string[];
}

export interface GroupPredictionRow {
  group: string;
  first: string;
  second: string;
  third: string;
}

export interface PlayerProfileData {
  playerId: string;
  name: string;
  rank: number;
  points: number;
  exactScores: number;
  correctResults: number;
  hitRate: string;
  positionChange: number;
  predictedChampion: string;
  championStatus: PredictionStatus;
  topScorerPrediction: TopScorerPrediction;
  knockoutPrediction: KnockoutRoundPrediction[];
  groupPredictions: GroupPredictionRow[];
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

export const leaderboardRows: LeaderboardRow[] = [
  { rank: 1, playerId: 'argo', player: 'Argo', points: 146, exactScores: 9, correctResults: 19, hitRate: '72%', positionChange: 2 },
  { rank: 2, playerId: 'kristo', player: 'Kristo', points: 141, exactScores: 8, correctResults: 18, hitRate: '69%', positionChange: -1 },
  { rank: 3, playerId: 'martin', player: 'Martin', points: 137, exactScores: 8, correctResults: 17, hitRate: '67%', positionChange: 1 },
  { rank: 4, playerId: 'mari', player: 'Mari', points: 128, exactScores: 7, correctResults: 16, hitRate: '64%', positionChange: -1 },
  { rank: 5, playerId: 'liis', player: 'Liis', points: 122, exactScores: 6, correctResults: 16, hitRate: '61%', positionChange: 0 },
  { rank: 6, playerId: 'taavi', player: 'Taavi', points: 118, exactScores: 6, correctResults: 15, hitRate: '59%', positionChange: 1 },
  { rank: 7, playerId: 'kadri', player: 'Kadri', points: 113, exactScores: 5, correctResults: 15, hitRate: '57%', positionChange: -2 },
  { rank: 8, playerId: 'juhan', player: 'Juhan', points: 107, exactScores: 5, correctResults: 14, hitRate: '54%', positionChange: 0 },
  { rank: 9, playerId: 'sander', player: 'Sander', points: 101, exactScores: 4, correctResults: 13, hitRate: '51%', positionChange: 2 },
  { rank: 10, playerId: 'helen', player: 'Helen', points: 96, exactScores: 4, correctResults: 12, hitRate: '49%', positionChange: -1 }
];

export const leaderboardPreview = leaderboardRows.slice(0, 5);

const baseGroups: GroupPredictionRow[] = [
  { group: 'A', first: 'Mexico', second: 'Japan', third: 'Morocco' },
  { group: 'B', first: 'Canada', second: 'Switzerland', third: 'Chile' },
  { group: 'C', first: 'Brazil', second: 'Croatia', third: 'Egypt' },
  { group: 'D', first: 'United States', second: 'Ghana', third: 'Norway' },
  { group: 'E', first: 'Germany', second: 'Colombia', third: 'Australia' },
  { group: 'F', first: 'Argentina', second: 'Korea Republic', third: 'Austria' },
  { group: 'G', first: 'France', second: 'Denmark', third: 'Costa Rica' },
  { group: 'H', first: 'Spain', second: 'Senegal', third: 'Iran' },
  { group: 'I', first: 'England', second: 'Serbia', third: 'Qatar' },
  { group: 'J', first: 'Portugal', second: 'Uruguay', third: 'South Africa' },
  { group: 'K', first: 'Netherlands', second: 'Poland', third: 'Saudi Arabia' },
  { group: 'L', first: 'Belgium', second: 'Ecuador', third: 'New Zealand' }
];

const argoBracket: KnockoutRoundPrediction[] = [
  { round: 'R32', teams: ['Mexico', 'Canada', 'Brazil', 'United States', 'Germany', 'Argentina', 'France', 'Spain'] },
  { round: 'R16', teams: ['Brazil', 'Argentina', 'France', 'Spain', 'England', 'Portugal'] },
  { round: 'QF', teams: ['Brazil', 'France', 'Argentina', 'Portugal'] },
  { round: 'SF', teams: ['Brazil', 'France'] },
  { round: 'Final', teams: ['Brazil'] }
];

const kristoBracket: KnockoutRoundPrediction[] = [
  { round: 'R32', teams: ['Mexico', 'Japan', 'Brazil', 'Germany', 'Argentina', 'France', 'England', 'Portugal'] },
  { round: 'R16', teams: ['Brazil', 'Germany', 'Argentina', 'France', 'England', 'Netherlands'] },
  { round: 'QF', teams: ['Argentina', 'France', 'England', 'Brazil'] },
  { round: 'SF', teams: ['Argentina', 'England'] },
  { round: 'Final', teams: ['Argentina'] }
];

const martinBracket: KnockoutRoundPrediction[] = [
  { round: 'R32', teams: ['Canada', 'Brazil', 'Croatia', 'Germany', 'Argentina', 'Spain', 'England', 'Portugal'] },
  { round: 'R16', teams: ['Brazil', 'Germany', 'Spain', 'England', 'Portugal', 'France'] },
  { round: 'QF', teams: ['Brazil', 'Spain', 'England', 'Portugal'] },
  { round: 'SF', teams: ['Spain', 'Portugal'] },
  { round: 'Final', teams: ['Spain'] }
];

export const playerProfiles: PlayerProfileData[] = leaderboardRows.map((row, index) => {
  const championCycle = [
    ['Brazil', 'Still alive'] as const,
    ['Argentina', 'Still alive'] as const,
    ['Spain', 'Still alive'] as const,
    ['France', 'Still alive'] as const,
    ['Germany', 'Eliminated'] as const,
    ['England', 'Still alive'] as const,
    ['Portugal', 'Still alive'] as const,
    ['Netherlands', 'Eliminated'] as const,
    ['Uruguay', 'Eliminated'] as const,
    ['Belgium', 'Eliminated'] as const
  ];
  const [predictedChampion, championStatus] = championCycle[index];
  const bracket = index === 0 ? argoBracket : index === 1 ? kristoBracket : martinBracket;
  return {
    playerId: row.playerId,
    name: row.player,
    rank: row.rank,
    points: row.points,
    exactScores: row.exactScores,
    correctResults: row.correctResults,
    hitRate: row.hitRate,
    positionChange: row.positionChange,
    predictedChampion,
    championStatus,
    topScorerPrediction: {
      name: ['Vinicius Junior', 'Lionel Messi', 'Kylian Mbappe', 'Harry Kane', 'Lamine Yamal'][index % 5],
      team: ['Brazil', 'Argentina', 'France', 'England', 'Spain'][index % 5],
      currentGoals: [4, 3, 5, 2, 3][index % 5],
      status: (['In chase', 'In chase', 'Leading', 'Eliminated', 'In chase'] as const)[index % 5]
    },
    knockoutPrediction: bracket,
    groupPredictions: rotateGroups(baseGroups, index)
  };
});

export function findPlayerProfile(playerId: string): PlayerProfileData {
  return playerProfiles.find((profile) => profile.playerId === playerId) ?? playerProfiles[0];
}

function rotateGroups(groups: GroupPredictionRow[], offset: number): GroupPredictionRow[] {
  return groups.map((group, index) => {
    if ((index + offset) % 4 !== 0) return group;
    return { ...group, first: group.second, second: group.first };
  });
}

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
