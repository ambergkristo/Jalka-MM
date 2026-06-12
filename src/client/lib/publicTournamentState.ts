import matchesJson from '../../data/worldcup2026/matches.json' with { type: 'json' };
import type { DashboardMetric, DashboardMatch, DashboardResult, GroupLeader, GroupStanding, TournamentStat, TournamentSummaryMetric, TournamentTopScorer } from '../data/mock.js';
import { getPublicMatchSection, type MatchSection } from '../data/publicDashboard.js';
import { initialGroupStandings, initialPlayoffBracket, initialTournamentStats } from '../data/publicTournamentFallback.js';
import type { BracketTree } from '../../domain/publicBracket.js';
import { buildCanonicalPublicLeaderboardEntries } from '../../domain/publicLeaderboard.js';
import { predictionRepository } from '../../domain/predictionRepository.js';
import { getZeroedLeaderboardRows, type LeaderboardRowView } from './predictionViewModels.js';

export interface PublicLeaderboardEntry {
  playerId: string;
  rank: number;
  points: number;
  exactScores: number;
  correctResults: number;
  hitRate: number;
  previousRank?: number;
}

export interface PublicDashboardSnapshotLike {
  upcomingMatches: DashboardMatch[];
  latestResults: DashboardResult[];
  groupStandings: GroupStanding[];
  groupLeaders: GroupLeader[];
  topScorers: TournamentTopScorer[];
  playoffBracket: BracketTree;
  tournamentSummary: TournamentSummaryMetric[];
  tournamentStats: TournamentStat[];
  tournamentProgressByStage: Array<{ stage: string; completed: number; total: number }>;
  leaderboard: PublicLeaderboardEntry[];
}

export interface PublicTournamentState {
  snapshot?: PublicDashboardSnapshotLike;
  playedCount: number;
  totalMatches: number;
  heroMetrics: DashboardMetric[];
  latestResults: DashboardResult[];
  upcomingMatches: DashboardMatch[];
  leaderboardRows: LeaderboardRowView[];
  groupStandings: GroupStanding[];
  groupLeaders: GroupLeader[];
  topScorers: TournamentTopScorer[];
  playoffBracket: BracketTree;
  tournamentSummary: TournamentSummaryMetric[];
  tournamentStats: TournamentStat[];
  tournamentProgressByStage: Array<{ stage: string; completed: number; total: number }>;
}

const totalMatches = (matchesJson as { id: number }[]).length;

export function buildPublicTournamentState(snapshot?: PublicDashboardSnapshotLike, now = new Date()): PublicTournamentState {
  const playedCount = snapshot?.latestResults.length ?? 0;
  const upcomingMatches = snapshot?.upcomingMatches ?? getPublicMatchSection(now).matches;
  const latestResults = snapshot?.latestResults ?? [];
  const groupStandings = snapshot?.groupStandings ?? initialGroupStandings;
  const groupLeaders = snapshot?.groupLeaders ?? groupStandings.map((group) => {
    const leader = group.teams[0];
    return {
      group: group.group,
      team: leader?.played ? leader.team : undefined,
      points: leader?.played ? leader.points : undefined,
      record: leader?.played ? `${leader.wins}-${leader.draws}-${leader.losses}` : undefined
    };
  });
  const topScorers = snapshot?.topScorers ?? [];
  const playoffBracket = snapshot?.playoffBracket ?? initialPlayoffBracket;
  const tournamentSummary = snapshot?.tournamentSummary ?? [
    { label: 'Turniiri faas', value: 'Alagrupid', detail: 'A-L alagruppide teine voor', tone: 'gold' },
    { label: 'Mängitud', value: `0 / ${totalMatches}`, detail: 'Kinnitatud tulemusi veel ei ole', tone: 'blue' },
    { label: 'Väravad', value: '0', detail: 'Kinnitatud väravaid veel ei ole', tone: 'green' },
    { label: 'Võistkonnad', value: '48', detail: '24 otsepääsu on mängus', tone: 'red' }
  ];
  const tournamentStats = snapshot?.tournamentStats ?? initialTournamentStats;
  const tournamentProgressByStage = snapshot?.tournamentProgressByStage ?? [
    { stage: 'Alagrupid', completed: 0, total: 72 },
    { stage: '1/16-finaalid', completed: 0, total: 16 },
    { stage: 'Kaheksandikfinaalid', completed: 0, total: 8 },
    { stage: 'Veerandfinaalid', completed: 0, total: 4 },
    { stage: 'Poolfinaalid', completed: 0, total: 2 },
    { stage: 'Finaalid', completed: 0, total: 2 }
  ];

  return {
    snapshot,
    playedCount,
    totalMatches,
    heroMetrics: buildHeroMetrics(playedCount, upcomingMatches),
    latestResults,
    upcomingMatches,
    leaderboardRows: buildLeaderboardRows(snapshot),
    groupStandings,
    groupLeaders,
    topScorers,
    playoffBracket,
    tournamentSummary,
    tournamentStats,
    tournamentProgressByStage
  };
}

export function selectPublicMatchSection(snapshot: PublicDashboardSnapshotLike | undefined, now = new Date(), limit = 3): MatchSection {
  if (!snapshot) return getPublicMatchSection(now);
  return {
    eyebrow: snapshot.latestResults.length > 0 ? 'Ajakava' : getPublicMatchSection(now).eyebrow,
    title: snapshot.latestResults.length > 0 ? 'Tulevad mängud' : getPublicMatchSection(now).title,
    matches: snapshot.upcomingMatches.slice(0, limit)
  };
}

export function buildLeaderboardRows(snapshot?: PublicDashboardSnapshotLike): LeaderboardRowView[] {
  const entries = buildCanonicalPublicLeaderboardEntries(snapshot?.leaderboard ?? []);
  return entries.map(toLeaderboardRow);
}

function buildHeroMetrics(playedCount: number, upcomingMatches: DashboardMatch[]): DashboardMetric[] {
  const nextMatch = upcomingMatches[0];
  return [
    { label: 'Turniiri algus', value: '11.06', detail: 'Esimene mäng 11. juunil 2026' },
    {
      label: 'Mängitud',
      value: `${playedCount} / ${totalMatches}`,
      detail: playedCount > 0 ? `${Math.max(totalMatches - playedCount, 0)} kohtumist on veel ees` : 'Kinnitatud tulemusi veel ei ole'
    },
    {
      label: 'Järgmine',
      value: nextMatch ? nextMatch.stage : 'Avapäev',
      detail: nextMatch ? `${nextMatch.homeTeam} vs ${nextMatch.awayTeam}` : 'Ajakava algab Mehhikos'
    }
  ];
}

function toLeaderboardRow(entry: PublicLeaderboardEntry): LeaderboardRowView {
  const player = predictionRepository.getPlayerById(entry.playerId);
  return {
    rank: entry.rank,
    playerId: entry.playerId,
    player: player?.name ?? entry.playerId,
    points: entry.points,
    exactScores: entry.exactScores,
    correctResults: entry.correctResults,
    hitRate: `${Math.round(entry.hitRate * 100)}%`,
    positionChange: entry.previousRank ? entry.previousRank - entry.rank : 0
  };
}
