import teamsJson from '../../data/worldcup2026/teams.json';
import { buildPublicPlayoffBracketTree } from '../../domain/publicBracket.js';
import type { PredictionLeagueInsights } from '../../domain/predictionLeagueInsights.js';
import type { GroupStanding, TournamentStat } from './mock.js';

interface TeamSeed {
  name: string;
  groupId?: string;
}

export const initialGroupStandings: GroupStanding[] = buildInitialGroupStandings(teamsJson as TeamSeed[]);

export const initialPlayoffBracket = buildPublicPlayoffBracketTree();

export const initialTournamentStats: TournamentStat[] = [
  { label: 'Väravaid kokku', value: '0', detail: 'Kinnitatud tulemuste põhjal' },
  { label: 'Keskmine', value: '0,00', detail: 'väravat mängu kohta' },
  { label: 'Nullimängud', value: '0', detail: 'Kinnitatud tulemuste põhjal' },
  { label: 'Suurim võit', value: 'Puudub', detail: 'Kinnitatud tulemuste põhjal' },
  { label: 'Väravaterohkeim', value: 'Puudub', detail: 'Kinnitatud tulemuste põhjal' }
];

export const initialPredictionLeagueInsights: PredictionLeagueInsights = {
  statistics: {
    eyebrow: 'Ennustusliiga',
    title: 'Ennustusliiga statistika',
    cards: [
      fallbackCard('player-count', 'Mängijate arv', 'Nr', 'blue', '109', 'Aktiivne edetabel', 'kanonilise edetabeli põhjal'),
      fallbackCard('average-points', 'Keskmine punktisumma', 'Av', 'blue', '0,00', '109 mängijat', 'kanonilise edetabeli põhjal'),
      fallbackCard('total-exact-scores', 'Kokku täpseid skoore', '6', 'purple', '0', '109 mängijat', 'kanonilise edetabeli põhjal')
    ]
  },
  records: {
    eyebrow: 'Rekordid',
    title: 'Rekordid',
    cards: [
      fallbackCard('current-leader', 'Liider', '1', 'gold', '—', 'Andmed puuduvad', 'Kinnitatud mänge veel ei ole', true),
      fallbackCard('highest-score', 'Kõige rohkem punkte', 'Pt', 'gold', '—', 'Andmed puuduvad', 'Kinnitatud mänge veel ei ole', true),
      fallbackCard('most-exact-scores', 'Kõige rohkem täpseid skoore', '6', 'purple', '—', 'Andmed puuduvad', 'Kinnitatud mänge veel ei ole', true),
      fallbackCard('highest-hit-rate', 'Parim tabavus', '%', 'purple', '—', 'Andmed puuduvad', 'Kinnitatud mänge veel ei ole', true)
    ]
  }
};

function buildInitialGroupStandings(teams: TeamSeed[]): GroupStanding[] {
  const groups = [...new Set(teams.map((team) => team.groupId).filter(Boolean))].sort() as string[];
  return groups.map((group) => ({
    group,
    teams: teams
      .filter((team) => team.groupId === group)
      .map((team, index) => ({
        rank: index + 1,
        team: team.name,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
        state: 'at-risk'
      }))
  }));
}

function fallbackCard(
  id: string,
  title: string,
  badge: string,
  tone: 'gold' | 'purple' | 'green' | 'red' | 'blue',
  value: string,
  subject: string,
  detail: string,
  unavailable = false
) {
  return { id, title, badge, tone, value, subject, detail, unavailable };
}
