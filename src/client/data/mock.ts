export interface DashboardMetric {
  label: string;
  value: string;
  detail: string;
}

export interface DashboardMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  kickoffTime: string;
  stage: string;
  status: 'scheduled' | 'live' | 'confirming' | 'final';
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
  team?: string;
  points?: number;
  record?: string;
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
  status: 'scheduled' | 'live' | 'finished' | 'extra-time' | 'penalties';
  kickoffTime?: string;
  winner?: string;
}

export interface KnockoutStageData {
  stage: 'R32' | 'R16' | 'QF' | 'SF' | 'Final';
  title: string;
  matches: KnockoutMatch[];
}

export type BracketStage = 'R32' | 'R16' | 'QF' | 'SF' | 'FINAL' | 'THIRD_PLACE';
export type BracketSideName = 'LEFT' | 'RIGHT' | 'CENTER';

export interface BracketSlot {
  id: string;
  label: string;
  source?: string;
  teamId?: string;
  teamName?: string;
  teamCode?: string;
  seedLabel?: string;
}

export interface BracketMatch {
  id: string;
  stage: BracketStage;
  side: BracketSideName;
  roundIndex: number;
  order: number;
  homeSlot: BracketSlot;
  awaySlot: BracketSlot;
  homeScore?: number;
  awayScore?: number;
  winnerTeamId?: string;
  status: 'scheduled' | 'live' | 'finished' | 'extra-time' | 'penalties';
  kickoffUtc?: string;
}

export interface BracketRound {
  id: string;
  label: string;
  roundIndex: number;
  matches: BracketMatch[];
}

export interface BracketSide {
  side: Exclude<BracketSideName, 'CENTER'>;
  rounds: BracketRound[];
}

export interface BracketTree {
  left: BracketSide;
  right: BracketSide;
  final: BracketMatch;
  thirdPlace: BracketMatch;
}

export interface TournamentTopScorer {
  rank: number;
  playerId?: string;
  providerPlayerId?: string;
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
  { label: 'Turniiri algus', value: '11.06', detail: 'Esimene mäng 11. juunil 2026' },
  { label: 'Mängitud', value: '0 / 104', detail: 'Kinnitatud tulemusi veel ei ole' },
  { label: 'Järgmine', value: 'Avapäev', detail: 'Ajakava algab Mehhikos' }
];

export const groupLeaders: GroupLeader[] = [
  { group: 'A' },
  { group: 'B' },
  { group: 'C' },
  { group: 'D' },
  { group: 'E' },
  { group: 'F' },
  { group: 'G' },
  { group: 'H' },
  { group: 'I' },
  { group: 'J' },
  { group: 'K' },
  { group: 'L' }
];

export const navigationCards: NavigationCardData[] = [
  { title: 'Tulemused', description: 'Mängud, seisud ja ajakava', href: '/results', accent: 'blue' },
  { title: 'Edetabel', description: 'Ennustusliiga kohad ja punktid', href: '/leaderboard', accent: 'gold' },
  { title: 'Turniir', description: 'Alagrupid, play-off ja statistika', href: '/tournament', accent: 'green' }
];

export const tournamentSummary: TournamentSummaryMetric[] = [
  { label: 'Turniiri faas', value: 'Alagrupid', detail: 'A-L alagruppide teine voor', tone: 'gold' },
  { label: 'Mängitud', value: '18 / 104', detail: '86 kohtumist on veel ees', tone: 'blue' },
  { label: 'Väravad', value: '52', detail: '2,89 väravat mängu kohta', tone: 'green' },
  { label: 'Võistkonnad', value: '48', detail: '24 otsepääsu on mängus', tone: 'red' }
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
    title: '1/16-finaalid',
    matches: [
      { id: 'r32-1', label: '1/16-1', teamOne: 'Mexico', teamTwo: 'Chile', teamOneScore: 2, teamTwoScore: 1, status: 'finished', winner: 'Mexico' },
      { id: 'r32-2', label: '1/16-2', teamOne: 'Brazil', teamTwo: 'Norway', teamOneScore: 3, teamTwoScore: 0, status: 'finished', winner: 'Brazil' },
      { id: 'r32-3', label: '1/16-3', teamOne: 'Germany', teamTwo: 'Austria', status: 'scheduled', kickoffTime: '29. juuni 20:00' },
      { id: 'r32-4', label: '1/16-4', teamOne: 'France', teamTwo: 'Iran', status: 'scheduled', kickoffTime: '30. juuni 23:00' }
    ]
  },
  {
    stage: 'R16',
    title: 'Kaheksandikfinaalid',
    matches: [
      { id: 'r16-1', label: '1/8-1', teamOne: 'Mexico', teamTwo: 'Brazil', status: 'scheduled', kickoffTime: '4. juuli 21:00' },
      { id: 'r16-2', label: '1/8-2', teamOne: 'Canada', teamTwo: 'Argentina', status: 'scheduled', kickoffTime: '5. juuli 02:00' },
      { id: 'r16-3', label: '1/8-3', teamOne: 'England', teamTwo: 'Uruguay', status: 'scheduled', kickoffTime: '5. juuli 21:00' }
    ]
  },
  {
    stage: 'QF',
    title: 'Veerandfinaalid',
    matches: [
      { id: 'qf-1', label: 'VF-1', teamOne: '1/8-1 võitja', teamTwo: '1/8-2 võitja', status: 'scheduled', kickoffTime: '9. juuli 22:00' },
      { id: 'qf-2', label: 'VF-2', teamOne: '1/8-3 võitja', teamTwo: 'Spain', status: 'scheduled', kickoffTime: '10. juuli 02:00' }
    ]
  },
  {
    stage: 'SF',
    title: 'Poolfinaalid',
    matches: [
      { id: 'sf-1', label: 'PF-1', teamOne: 'VF-1 võitja', teamTwo: 'VF-2 võitja', status: 'scheduled', kickoffTime: '14. juuli 22:00' },
      { id: 'sf-2', label: 'PF-2', teamOne: 'France', teamTwo: 'Portugal', status: 'scheduled', kickoffTime: '15. juuli 22:00' }
    ]
  },
  {
    stage: 'Final',
    title: 'Finaal',
    matches: [
      { id: 'final-1', label: 'Finaal', teamOne: 'PF-1 võitja', teamTwo: 'PF-2 võitja', status: 'scheduled', kickoffTime: '19. juuli 22:00' }
    ]
  }
];

const knownSlot = (id: string, teamName: string, teamCode: string, seedLabel?: string): BracketSlot => ({
  id,
  label: teamName,
  teamId: teamCode.toLowerCase(),
  teamName,
  teamCode,
  seedLabel
});

const pendingSlot = (id: string, label: string, source?: string): BracketSlot => ({
  id,
  label,
  seedLabel: label,
  source
});

export const playoffBracketTree: BracketTree = {
  left: {
    side: 'LEFT',
    rounds: [
      {
        id: 'left-r32',
        label: '1/16-finaalid',
        roundIndex: 0,
        matches: [
          {
            id: 'r32-1',
            stage: 'R32',
            side: 'LEFT',
            roundIndex: 0,
            order: 1,
            homeSlot: knownSlot('mex', 'Mehhiko', 'MEX', 'A1'),
            awaySlot: knownSlot('chi', 'Tšiili', 'CHI', 'B3'),
            homeScore: 2,
            awayScore: 1,
            winnerTeamId: 'mex',
            status: 'finished',
            kickoffUtc: '2026-06-29T20:00:00.000Z'
          },
          {
            id: 'r32-2',
            stage: 'R32',
            side: 'LEFT',
            roundIndex: 0,
            order: 2,
            homeSlot: knownSlot('bra', 'Brasiilia', 'BRA', 'C1'),
            awaySlot: knownSlot('nor', 'Norra', 'NOR', 'D3'),
            homeScore: 3,
            awayScore: 0,
            winnerTeamId: 'bra',
            status: 'finished',
            kickoffUtc: '2026-06-30T00:00:00.000Z'
          },
          {
            id: 'r32-3',
            stage: 'R32',
            side: 'LEFT',
            roundIndex: 0,
            order: 3,
            homeSlot: pendingSlot('a1', 'A1'),
            awaySlot: pendingSlot('c2', 'C2'),
            status: 'scheduled',
            kickoffUtc: '2026-06-30T20:00:00.000Z'
          },
          {
            id: 'r32-4',
            stage: 'R32',
            side: 'LEFT',
            roundIndex: 0,
            order: 4,
            homeSlot: pendingSlot('e1', 'E1'),
            awaySlot: pendingSlot('best-third-1', 'Parim 3. koht'),
            status: 'scheduled',
            kickoffUtc: '2026-07-01T00:00:00.000Z'
          },
          {
            id: 'r32-9',
            stage: 'R32',
            side: 'LEFT',
            roundIndex: 0,
            order: 5,
            homeSlot: knownSlot('esp', 'Hispaania', 'ESP', 'H1'),
            awaySlot: knownSlot('sen', 'Senegal', 'SEN', 'G2'),
            status: 'scheduled',
            kickoffUtc: '2026-07-01T21:00:00.000Z'
          },
          {
            id: 'r32-6',
            stage: 'R32',
            side: 'LEFT',
            roundIndex: 0,
            order: 6,
            homeSlot: knownSlot('can', 'Kanada', 'CAN', 'B1'),
            awaySlot: knownSlot('sui', 'Šveits', 'SUI', 'A2'),
            status: 'scheduled',
            kickoffUtc: '2026-07-02T01:00:00.000Z'
          },
          {
            id: 'r32-7',
            stage: 'R32',
            side: 'LEFT',
            roundIndex: 0,
            order: 7,
            homeSlot: pendingSlot('i1', 'I1'),
            awaySlot: pendingSlot('j2', 'J2'),
            status: 'scheduled',
            kickoffUtc: '2026-07-02T21:00:00.000Z'
          },
          {
            id: 'r32-8',
            stage: 'R32',
            side: 'LEFT',
            roundIndex: 0,
            order: 8,
            homeSlot: pendingSlot('k1', 'K1'),
            awaySlot: pendingSlot('l2', 'L2'),
            status: 'scheduled',
            kickoffUtc: '2026-07-03T01:00:00.000Z'
          }
        ]
      },
      {
        id: 'left-r16',
        label: '1/8-finaalid',
        roundIndex: 1,
        matches: [
          {
            id: 'r16-1',
            stage: 'R16',
            side: 'LEFT',
            roundIndex: 1,
            order: 1,
            homeSlot: knownSlot('mex', 'Mehhiko', 'MEX', '1/16-1 võitja'),
            awaySlot: knownSlot('bra', 'Brasiilia', 'BRA', '1/16-2 võitja'),
            status: 'scheduled',
            kickoffUtc: '2026-07-04T21:00:00.000Z'
          },
          {
            id: 'r16-2',
            stage: 'R16',
            side: 'LEFT',
            roundIndex: 1,
            order: 2,
            homeSlot: pendingSlot('winner-r32-3', '1/16-3 võitja', 'r32-3'),
            awaySlot: pendingSlot('winner-r32-4', '1/16-4 võitja', 'r32-4'),
            status: 'scheduled',
            kickoffUtc: '2026-07-05T01:00:00.000Z'
          },
          {
            id: 'r16-3',
            stage: 'R16',
            side: 'LEFT',
            roundIndex: 1,
            order: 3,
            homeSlot: pendingSlot('winner-r32-5', '1/16-5 võitja', 'r32-5'),
            awaySlot: pendingSlot('winner-r32-6', '1/16-6 võitja', 'r32-6'),
            status: 'scheduled',
            kickoffUtc: '2026-07-05T21:00:00.000Z'
          },
          {
            id: 'r16-4',
            stage: 'R16',
            side: 'LEFT',
            roundIndex: 1,
            order: 4,
            homeSlot: pendingSlot('winner-r32-7', '1/16-7 võitja', 'r32-7'),
            awaySlot: pendingSlot('winner-r32-8', '1/16-8 võitja', 'r32-8'),
            status: 'scheduled',
            kickoffUtc: '2026-07-06T01:00:00.000Z'
          }
        ]
      },
      {
        id: 'left-qf',
        label: 'Veerandfinaalid',
        roundIndex: 2,
        matches: [
          {
            id: 'qf-1',
            stage: 'QF',
            side: 'LEFT',
            roundIndex: 2,
            order: 1,
            homeSlot: pendingSlot('winner-r16-1', '1/8-1 võitja', 'r16-1'),
            awaySlot: pendingSlot('winner-r16-2', '1/8-2 võitja', 'r16-2'),
            status: 'scheduled',
            kickoffUtc: '2026-07-09T22:00:00.000Z'
          },
          {
            id: 'qf-2',
            stage: 'QF',
            side: 'LEFT',
            roundIndex: 2,
            order: 2,
            homeSlot: pendingSlot('winner-r16-3', '1/8-3 võitja', 'r16-3'),
            awaySlot: pendingSlot('winner-r16-4', '1/8-4 võitja', 'r16-4'),
            status: 'scheduled',
            kickoffUtc: '2026-07-10T02:00:00.000Z'
          }
        ]
      },
      {
        id: 'left-sf',
        label: 'Poolfinaal',
        roundIndex: 3,
        matches: [
          {
            id: 'sf-1',
            stage: 'SF',
            side: 'LEFT',
            roundIndex: 3,
            order: 1,
            homeSlot: pendingSlot('winner-qf-1', 'VF-1 võitja', 'qf-1'),
            awaySlot: pendingSlot('winner-qf-2', 'VF-2 võitja', 'qf-2'),
            status: 'scheduled',
            kickoffUtc: '2026-07-14T22:00:00.000Z'
          }
        ]
      }
    ]
  },
  right: {
    side: 'RIGHT',
    rounds: [
      {
        id: 'right-r32',
        label: '1/16-finaalid',
        roundIndex: 0,
        matches: [
          {
            id: 'r32-5',
            stage: 'R32',
            side: 'RIGHT',
            roundIndex: 0,
            order: 1,
            homeSlot: knownSlot('eng', 'Inglismaa', 'ENG', 'I1'),
            awaySlot: knownSlot('uru', 'Uruguay', 'URU', 'J2'),
            status: 'scheduled',
            kickoffUtc: '2026-07-01T21:00:00.000Z'
          },
          {
            id: 'r32-10',
            stage: 'R32',
            side: 'RIGHT',
            roundIndex: 0,
            order: 2,
            homeSlot: knownSlot('fra', 'Prantsusmaa', 'FRA', 'G1'),
            awaySlot: knownSlot('irn', 'Iraan', 'IRN', 'H3'),
            status: 'scheduled',
            kickoffUtc: '2026-07-02T01:00:00.000Z'
          },
          {
            id: 'r32-11',
            stage: 'R32',
            side: 'RIGHT',
            roundIndex: 0,
            order: 3,
            homeSlot: knownSlot('ned', 'Holland', 'NED', 'K1'),
            awaySlot: knownSlot('pol', 'Poola', 'POL', 'L2'),
            status: 'scheduled',
            kickoffUtc: '2026-07-02T21:00:00.000Z'
          },
          {
            id: 'r32-12',
            stage: 'R32',
            side: 'RIGHT',
            roundIndex: 0,
            order: 4,
            homeSlot: pendingSlot('best-third-2', 'Parim 3. koht'),
            awaySlot: pendingSlot('f2', 'F2'),
            status: 'scheduled',
            kickoffUtc: '2026-07-03T01:00:00.000Z'
          },
          {
            id: 'r32-13',
            stage: 'R32',
            side: 'RIGHT',
            roundIndex: 0,
            order: 5,
            homeSlot: knownSlot('arg', 'Argentina', 'ARG', 'J1'),
            awaySlot: knownSlot('aut', 'Austria', 'AUT', 'I2'),
            status: 'scheduled',
            kickoffUtc: '2026-07-03T21:00:00.000Z'
          },
          {
            id: 'r32-14',
            stage: 'R32',
            side: 'RIGHT',
            roundIndex: 0,
            order: 6,
            homeSlot: knownSlot('por', 'Portugal', 'POR', 'K1'),
            awaySlot: knownSlot('col', 'Kolumbia', 'COL', 'L2'),
            status: 'scheduled',
            kickoffUtc: '2026-07-04T01:00:00.000Z'
          },
          {
            id: 'r32-15',
            stage: 'R32',
            side: 'RIGHT',
            roundIndex: 0,
            order: 7,
            homeSlot: pendingSlot('g2', 'G2'),
            awaySlot: pendingSlot('h2', 'H2'),
            status: 'scheduled',
            kickoffUtc: '2026-07-04T21:00:00.000Z'
          },
          {
            id: 'r32-16',
            stage: 'R32',
            side: 'RIGHT',
            roundIndex: 0,
            order: 8,
            homeSlot: pendingSlot('best-third-3', 'Parim 3. koht'),
            awaySlot: pendingSlot('e2', 'E2'),
            status: 'scheduled',
            kickoffUtc: '2026-07-05T01:00:00.000Z'
          }
        ]
      },
      {
        id: 'right-r16',
        label: '1/8-finaalid',
        roundIndex: 1,
        matches: [
          {
            id: 'r16-5',
            stage: 'R16',
            side: 'RIGHT',
            roundIndex: 1,
            order: 1,
            homeSlot: pendingSlot('winner-r32-9', '1/16-9 võitja', 'r32-9'),
            awaySlot: pendingSlot('winner-r32-10', '1/16-10 võitja', 'r32-10'),
            status: 'scheduled',
            kickoffUtc: '2026-07-05T21:00:00.000Z'
          },
          {
            id: 'r16-6',
            stage: 'R16',
            side: 'RIGHT',
            roundIndex: 1,
            order: 2,
            homeSlot: pendingSlot('winner-r32-11', '1/16-11 võitja', 'r32-11'),
            awaySlot: pendingSlot('winner-r32-12', '1/16-12 võitja', 'r32-12'),
            status: 'scheduled',
            kickoffUtc: '2026-07-06T01:00:00.000Z'
          },
          {
            id: 'r16-7',
            stage: 'R16',
            side: 'RIGHT',
            roundIndex: 1,
            order: 3,
            homeSlot: pendingSlot('winner-r32-13', '1/16-13 võitja', 'r32-13'),
            awaySlot: pendingSlot('winner-r32-14', '1/16-14 võitja', 'r32-14'),
            status: 'scheduled',
            kickoffUtc: '2026-07-06T21:00:00.000Z'
          },
          {
            id: 'r16-8',
            stage: 'R16',
            side: 'RIGHT',
            roundIndex: 1,
            order: 4,
            homeSlot: pendingSlot('winner-r32-15', '1/16-15 võitja', 'r32-15'),
            awaySlot: pendingSlot('winner-r32-16', '1/16-16 võitja', 'r32-16'),
            status: 'scheduled',
            kickoffUtc: '2026-07-07T01:00:00.000Z'
          }
        ]
      },
      {
        id: 'right-qf',
        label: 'Veerandfinaalid',
        roundIndex: 2,
        matches: [
          {
            id: 'qf-3',
            stage: 'QF',
            side: 'RIGHT',
            roundIndex: 2,
            order: 1,
            homeSlot: pendingSlot('winner-r16-5', '1/8-5 võitja', 'r16-5'),
            awaySlot: pendingSlot('winner-r16-6', '1/8-6 võitja', 'r16-6'),
            status: 'scheduled',
            kickoffUtc: '2026-07-10T02:00:00.000Z'
          },
          {
            id: 'qf-4',
            stage: 'QF',
            side: 'RIGHT',
            roundIndex: 2,
            order: 2,
            homeSlot: pendingSlot('winner-r16-7', '1/8-7 võitja', 'r16-7'),
            awaySlot: pendingSlot('winner-r16-8', '1/8-8 võitja', 'r16-8'),
            status: 'scheduled',
            kickoffUtc: '2026-07-11T02:00:00.000Z'
          }
        ]
      },
      {
        id: 'right-sf',
        label: 'Poolfinaal',
        roundIndex: 3,
        matches: [
          {
            id: 'sf-2',
            stage: 'SF',
            side: 'RIGHT',
            roundIndex: 3,
            order: 1,
            homeSlot: pendingSlot('winner-qf-3', 'VF-3 võitja', 'qf-3'),
            awaySlot: pendingSlot('winner-qf-4', 'VF-4 võitja', 'qf-4'),
            status: 'scheduled',
            kickoffUtc: '2026-07-15T22:00:00.000Z'
          }
        ]
      }
    ]
  },
  final: {
    id: 'final',
    stage: 'FINAL',
    side: 'CENTER',
    roundIndex: 4,
    order: 1,
    homeSlot: pendingSlot('winner-sf-1', 'PF-1 võitja', 'sf-1'),
    awaySlot: pendingSlot('winner-sf-2', 'PF-2 võitja', 'sf-2'),
    status: 'scheduled',
    kickoffUtc: '2026-07-19T22:00:00.000Z'
  },
  thirdPlace: {
    id: 'third-place',
    stage: 'THIRD_PLACE',
    side: 'CENTER',
    roundIndex: 4,
    order: 2,
    homeSlot: pendingSlot('loser-sf-1', 'PF-1 kaotaja', 'sf-1'),
    awaySlot: pendingSlot('loser-sf-2', 'PF-2 kaotaja', 'sf-2'),
    status: 'scheduled',
    kickoffUtc: '2026-07-18T22:00:00.000Z'
  }
};

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
  { label: 'Väravaid kokku', value: '52', detail: '18 lõppenud mänguga' },
  { label: 'Keskmine', value: '2,89', detail: 'väravat mängu kohta' },
  { label: 'Nullimängud', value: '7', detail: 'Saksamaal ja Brasiilial üks' },
  { label: 'Suurim võit', value: 'Argentiina 3-0', detail: 'Korea vastu' },
  { label: 'Väravaterohkeim', value: 'USA 3-2 Ghana', detail: 'viie väravaga alagrupimäng' }
];

export const topScorers = tournamentTopScorers.slice(0, 3).map(({ rank, player, team, goals }) => ({
  rank,
  player,
  team,
  goals
}));

export const tournamentProgressByStage = [
  { stage: 'Alagrupid', completed: 18, total: 72 },
  { stage: '1/16-finaalid', completed: 2, total: 16 },
  { stage: 'Kaheksandikfinaalid', completed: 0, total: 8 },
  { stage: 'Veerandfinaalid', completed: 0, total: 4 },
  { stage: 'Poolfinaalid', completed: 0, total: 2 },
  { stage: 'Finaalid', completed: 0, total: 2 }
];

