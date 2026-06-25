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
    eyebrow: 'Live',
    title: 'Ennustusliiga statistika',
    cards: [
      fallbackCard('highest-hit-rate', 'Highest hit rate', '%', 'purple', '—', 'Andmed puuduvad', 'Kinnitatud mänge veel ei ole', true),
      fallbackCard('most-exact-scores', 'Most exact scores', '6', 'purple', '—', 'Andmed puuduvad', 'Kinnitatud mänge veel ei ole', true),
      fallbackCard('biggest-rise-today', 'Biggest rise today', '+', 'green', '—', 'Andmed puuduvad', 'Tänaseid tõuse veel ei ole', true),
      fallbackCard('biggest-fall-today', 'Biggest fall today', '-', 'red', '—', 'Andmed puuduvad', 'Tänaseid langusi veel ei ole', true),
      fallbackCard('current-correct-streak', 'Longest current correct prediction streak', 'St', 'green', '—', 'Andmed puuduvad', 'Kinnitatud mänge veel ei ole', true),
      fallbackCard('current-no-point-streak', 'Longest current no-point streak', '0', 'red', '—', 'Andmed puuduvad', 'Kinnitatud mänge veel ei ole', true),
      fallbackCard('total-points-awarded', 'Total points awarded', 'Pt', 'blue', '0', '109 mängijat', 'kõigile mängijatele kokku'),
      fallbackCard('average-points', 'Average points per player', 'Av', 'blue', '0,00', '109 mängijat', 'keskmine punktisumma'),
      fallbackCard('average-exacts', 'Average exact scores per player', 'Ex', 'blue', '0,00', '109 mängijat', 'täpset skoori mängija kohta')
    ]
  },
  records: {
    eyebrow: 'Rekordid',
    title: 'Rekordid',
    cards: [
      fallbackCard('current-leader', 'Current tournament leader', '1', 'gold', '—', 'Andmed puuduvad', 'Kinnitatud mänge veel ei ole', true),
      fallbackCard('highest-score', 'Highest score', 'Hi', 'gold', '—', 'Andmed puuduvad', 'Kinnitatud mänge veel ei ole', true),
      fallbackCard('record-most-exacts', 'Most exact scores', '6', 'gold', '—', 'Andmed puuduvad', 'Kinnitatud mänge veel ei ole', true),
      fallbackCard('record-highest-hit-rate', 'Highest hit %', '%', 'gold', '—', 'Andmed puuduvad', 'Kinnitatud mänge veel ei ole', true),
      fallbackCard('highest-single-matchday-score', 'Highest single matchday score', 'Md', 'gold', '—', 'Andmed puuduvad', 'Kinnitatud mänge veel ei ole', true),
      fallbackCard('largest-climb', 'Largest climb in one day', '+', 'green', '—', 'Andmed puuduvad', 'Ühe päeva tõuse veel ei ole', true),
      fallbackCard('largest-drop', 'Largest drop in one day', '-', 'red', '—', 'Andmed puuduvad', 'Ühe päeva langusi veel ei ole', true),
      fallbackCard('longest-correct-streak', 'Longest correct prediction streak', 'St', 'green', '—', 'Andmed puuduvad', 'Kinnitatud mänge veel ei ole', true),
      fallbackCard('longest-no-point-streak', 'Longest no-point streak', '0', 'red', '—', 'Andmed puuduvad', 'Kinnitatud mänge veel ei ole', true),
      fallbackCard('most-bonus-points', 'Most points earned from bonus scoring', 'Bn', 'gold', '—', 'Andmed puuduvad', 'Boone veel ei ole', true),
      fallbackCard('best-group-stage-predictor', 'Best group-stage predictor', 'Gr', 'purple', '—', 'Andmed puuduvad', 'Kinnitatud mänge veel ei ole', true),
      fallbackCard('best-knockout-predictor', 'Best knockout predictor', 'Ko', 'purple', '—', 'Andmed puuduvad', 'Playoff pole veel alanud', true)
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
