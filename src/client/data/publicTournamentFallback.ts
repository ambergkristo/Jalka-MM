import teamsJson from '../../data/worldcup2026/teams.json';
import { buildPublicPlayoffBracketTree } from '../../domain/publicBracket.js';
import type { GroupStanding, TournamentStat, TournamentSummaryMetric } from './mock.js';

interface TeamSeed {
  name: string;
  groupId?: string;
}

export const initialGroupStandings: GroupStanding[] = buildInitialGroupStandings(teamsJson as TeamSeed[]);

export const initialPlayoffBracket = buildPublicPlayoffBracketTree();

export const initialTournamentSummary: TournamentSummaryMetric[] = [
  { label: 'Turniiri faas', value: 'Alagrupid', detail: 'Avamängu ootel', tone: 'gold' },
  { label: 'Mängitud', value: '0 / 104', detail: '104 kohtumist on veel ees', tone: 'blue' },
  { label: 'Väravad', value: '0', detail: 'Kinnitatud väravaid veel ei ole', tone: 'green' },
  { label: 'Võistkonnad', value: '48', detail: 'Alagrupid A-L', tone: 'red' }
];

export const initialTournamentStats: TournamentStat[] = [
  { label: 'Väravaid kokku', value: '0', detail: 'Kinnitatud tulemuste põhjal' },
  { label: 'Keskmine', value: '0,00', detail: 'väravat mängu kohta' },
  { label: 'Nullimängud', value: '0', detail: 'Kinnitatud tulemuste põhjal' },
  { label: 'Suurim võit', value: 'Puudub', detail: 'Kinnitatud tulemuste põhjal' },
  { label: 'Väravaterohkeim', value: 'Puudub', detail: 'Kinnitatud tulemuste põhjal' }
];

export const initialTournamentProgressByStage = [
  { stage: 'Alagrupid', completed: 0, total: 72 },
  { stage: '1/16-finaalid', completed: 0, total: 16 },
  { stage: 'Kaheksandikfinaalid', completed: 0, total: 8 },
  { stage: 'Veerandfinaalid', completed: 0, total: 4 },
  { stage: 'Poolfinaalid', completed: 0, total: 2 },
  { stage: 'Finaalid', completed: 0, total: 2 }
];

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
