import type { GroupPrediction, KnockoutRoundPrediction, PredictionBundle, PredictionStatus, TopScorerPredictionStatus } from '../../domain/predictionRepository.js';
import { predictionRepository } from '../../domain/predictionRepository.js';
import { resolveScorerTeam } from './scorerTeamLookup.js';

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
  groupPredictions: GroupPrediction[];
  errors: string[];
}

export function getLeaderboardRows(): LeaderboardRowView[] {
  return predictionRepository.getLeaderboard().map((entry) => {
    const player = predictionRepository.getPlayerById(entry.playerId);
    return {
      rank: entry.rank,
      playerId: entry.playerId,
      player: player?.name ?? entry.playerId,
      points: entry.points,
      exactScores: entry.exactScores,
      correctResults: entry.correctResults,
      hitRate: formatHitRate(entry.hitRate),
      positionChange: entry.previousRank ? entry.previousRank - entry.rank : 0
    };
  });
}

export function getZeroedLeaderboardRows(): LeaderboardRowView[] {
  const rows = getLeaderboardRows();
  const sourceRows = rows.length > 0
    ? rows
    : predictionRepository.getPlayers().map((player, index) => ({
      rank: index + 1,
      playerId: player.id,
      player: player.name,
      points: 0,
      exactScores: 0,
      correctResults: 0,
      hitRate: '0%',
      positionChange: 0
    }));
  return sourceRows.map((row, index) => ({
    ...row,
    rank: index + 1,
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
    points: entry?.points ?? 0,
    exactScores: entry?.exactScores ?? 0,
    correctResults: entry?.correctResults ?? 0,
    hitRate: entry ? formatHitRate(entry.hitRate) : '0%',
    positionChange: entry?.previousRank ? entry.previousRank - entry.rank : 0,
    predictedChampion: awards?.championTeam ?? 'Ennustus puudub',
    championStatus: awards?.championStatus ?? 'Eliminated',
    topScorerPrediction: {
      name: awards?.topScorerName ?? 'Ennustus puudub',
      team: awards?.topScorerName ? resolveScorerTeam(awards.topScorerName, awards.topScorerTeam) : 'Võistkond teadmata',
      currentGoals: awards?.topScorerCurrentGoals ?? 0,
      status: awards?.topScorerStatus ?? 'Eliminated'
    },
    knockoutPrediction: bundle.knockoutPrediction?.rounds ?? [],
    groupPredictions: bundle.groupPredictions,
    errors: bundle.errors
  };
}

function formatHitRate(hitRate: number): string {
  return `${Math.round(hitRate * 100)}%`;
}
