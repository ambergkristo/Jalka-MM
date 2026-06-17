import matchesJson from '../../data/worldcup2026/matches.json';
import type { Match } from '../../domain/types.js';
import { buildCanonicalPublicLeaderboardEntries } from '../../domain/publicLeaderboard.js';
import type { GroupPrediction, KnockoutRoundPrediction, PredictionBundle, PredictionStatus, TopScorerPredictionStatus } from '../../domain/predictionRepository.js';
import { predictionRepository } from '../../domain/predictionRepository.js';
import { resolveScorerIdentity } from '../../domain/scorerIdentity.js';
import type { TournamentTopScorer } from '../data/mock.js';
import { calculateRankMovement } from './leaderboardMovement.js';
import { resolveScorerTeam } from './scorerTeamLookup.js';
import { teamFromName } from './teamLookup.js';

export interface LeaderboardRowView {
  rank: number;
  playerId: string;
  player: string;
  points: number;
  exactScores: number;
  correctResults: number;
  hitRate: string;
  positionChange: number;
}

export interface TopScorerPredictionView {
  name: string;
  team: string;
  currentGoals: number;
  status: TopScorerPredictionStatus;
}

export interface PlayerProfileView {
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
  topScorerPrediction: TopScorerPredictionView;
  knockoutPrediction: KnockoutRoundPrediction[];
  groupPredictions: PlayerGroupPredictionView[];
  errors: string[];
}

export interface PlayerGroupPredictionView extends GroupPrediction {
  matchPredictions: GroupMatchPredictionView[];
}

export interface GroupMatchPredictionView {
  matchId: number;
  kickoffAt?: string;
  homeTeam: string;
  homeTeamCode?: string;
  awayTeam: string;
  awayTeamCode?: string;
  homeScore: number;
  awayScore: number;
}

const matchesById = new Map((matchesJson as Match[]).map((match) => [match.id, match]));

export function getLeaderboardRows(): LeaderboardRowView[] {
  return buildCanonicalPublicLeaderboardEntries().map(toLeaderboardRow);
}

export function getZeroedLeaderboardRows(): LeaderboardRowView[] {
  return buildCanonicalPublicLeaderboardEntries().map((entry) => ({
    rank: entry.rank,
    playerId: entry.playerId,
    player: predictionRepository.getPlayerById(entry.playerId)?.name ?? entry.playerId,
    points: 0,
    exactScores: 0,
    correctResults: 0,
    hitRate: '0%',
    positionChange: 0
  }));
}

export function getPlayerProfile(playerId: string): PlayerProfileView | undefined {
  const bundle = predictionRepository.getPlayerPredictionBundle(playerId);
  if (!bundle) return undefined;
  return toPlayerProfileView(bundle);
}

export function applyLeaderboardRowToPlayerProfile(profile: PlayerProfileView, row: LeaderboardRowView | undefined): PlayerProfileView {
  if (!row) return profile;
  return {
    ...profile,
    rank: row.rank,
    points: row.points,
    exactScores: row.exactScores,
    correctResults: row.correctResults,
    hitRate: row.hitRate,
    positionChange: row.positionChange
  };
}

export function applyTopScorersToPlayerProfile(profile: PlayerProfileView, topScorers: TournamentTopScorer[]): PlayerProfileView {
  const scorer = findMatchingTopScorer(profile.topScorerPrediction.name, topScorers);
  if (!scorer) return profile;
  const leadingGoals = Math.max(...topScorers.map((row) => row.goals), 0);
  return {
    ...profile,
    topScorerPrediction: {
      ...profile.topScorerPrediction,
      currentGoals: scorer.goals,
      status: leadingGoals > 0 && scorer.goals === leadingGoals ? 'Leading' : 'In chase'
    }
  };
}

export function getPredictionSeedErrors(): string[] {
  return predictionRepository.getErrors();
}

function toPlayerProfileView(bundle: PredictionBundle): PlayerProfileView {
  const entry = bundle.leaderboardEntry;
  const awards = bundle.awardsPrediction;
  return {
    playerId: bundle.player.id,
    name: bundle.player.name,
    rank: entry?.rank ?? 0,
    points: 0,
    exactScores: 0,
    correctResults: 0,
    hitRate: '0%',
    positionChange: 0,
    predictedChampion: awards?.championTeam ?? 'Ennustus puudub',
    championStatus: awards?.championStatus ?? 'Eliminated',
    topScorerPrediction: {
      name: awards?.topScorerName ?? 'Ennustus puudub',
      team: awards?.topScorerName ? resolveScorerTeam(awards.topScorerName, awards.topScorerTeam) : 'Võistkond teadmata',
      currentGoals: awards?.topScorerCurrentGoals ?? 0,
      status: awards?.topScorerStatus ?? 'Eliminated'
    },
    knockoutPrediction: bundle.knockoutPrediction?.rounds ?? [],
    groupPredictions: withGroupMatchPredictions(bundle),
    errors: bundle.errors
  };
}

function withGroupMatchPredictions(bundle: PredictionBundle): PlayerGroupPredictionView[] {
  const matchPredictionsByGroup = new Map<string, GroupMatchPredictionView[]>();
  for (const prediction of bundle.matchPredictions) {
    const match = matchesById.get(prediction.matchId);
    if (!match?.groupId) continue;
    const homeTeam = prediction.predictedHomeTeam ?? match.homeSlot;
    const awayTeam = prediction.predictedAwayTeam ?? match.awaySlot;
    const home = teamFromName(homeTeam);
    const away = teamFromName(awayTeam);
    const rows = matchPredictionsByGroup.get(match.groupId) ?? [];
    rows.push({
      matchId: prediction.matchId,
      kickoffAt: match.kickoffAt,
      homeTeam: home.name,
      homeTeamCode: home.code,
      awayTeam: away.name,
      awayTeamCode: away.code,
      homeScore: prediction.homeScore,
      awayScore: prediction.awayScore
    });
    matchPredictionsByGroup.set(match.groupId, rows);
  }

  for (const rows of matchPredictionsByGroup.values()) {
    rows.sort((a, b) => a.matchId - b.matchId);
  }

  return bundle.groupPredictions.map((group) => ({
    ...group,
    matchPredictions: matchPredictionsByGroup.get(group.group) ?? []
  }));
}

function formatHitRate(hitRate: number): string {
  return `${Math.round(hitRate * 100)}%`;
}

function toLeaderboardRow(entry: { rank: number; playerId: string; points: number; exactScores: number; correctResults: number; hitRate: number; previousRank?: number }): LeaderboardRowView {
  const player = predictionRepository.getPlayerById(entry.playerId);
  return {
    rank: entry.rank,
    playerId: entry.playerId,
    player: player?.name ?? entry.playerId,
    points: entry.points,
    exactScores: entry.exactScores,
    correctResults: entry.correctResults,
    hitRate: formatHitRate(entry.hitRate),
    positionChange: calculateRankMovement(entry.previousRank, entry.rank)
  };
}

function findMatchingTopScorer(playerName: string, topScorers: TournamentTopScorer[]): TournamentTopScorer | undefined {
  const predicted = resolveScorerIdentity({ playerName });
  if (!predicted.playerName) return undefined;
  return topScorers.find((scorer) => {
    const actual = resolveScorerIdentity({
      playerName: scorer.player,
      playerId: scorer.playerId,
      providerPlayerId: scorer.providerPlayerId
    });
    if (predicted.providerPlayerId && actual.providerPlayerId === predicted.providerPlayerId) return true;
    if (predicted.playerId && actual.playerId === predicted.playerId) return true;
    return actual.lookupKey === predicted.lookupKey;
  });
}
