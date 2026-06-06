import { useEffect, useState } from 'react';
import type { DashboardMatch, DashboardResult, GroupLeader, GroupStanding, TournamentStat, TournamentSummaryMetric, TournamentTopScorer } from '../data/mock.js';
import type { LeaderboardRowView } from './predictionViewModels.js';
import { predictionRepository } from '../../domain/predictionRepository.js';
import type { BracketTree } from '../../domain/publicBracket.js';

export interface PublicDashboardSnapshot {
  upcomingMatches: DashboardMatch[];
  latestResults: DashboardResult[];
  groupStandings: GroupStanding[];
  groupLeaders: GroupLeader[];
  topScorers: TournamentTopScorer[];
  playoffBracket: BracketTree;
  tournamentSummary: TournamentSummaryMetric[];
  tournamentStats: TournamentStat[];
  tournamentProgressByStage: Array<{ stage: string; completed: number; total: number }>;
}

interface LeaderboardApiResponse {
  mode: 'persisted' | 'seed' | 'pre-results';
  recalculatedAt?: string;
  warnings: string[];
  entries: Array<{
    playerId: string;
    rank: number;
    points: number;
    exactScores: number;
    correctResults: number;
    hitRate: number;
    previousRank?: number;
  }>;
}

export function usePublicDashboardSnapshot(): PublicDashboardSnapshot | undefined {
  const [snapshot, setSnapshot] = useState<PublicDashboardSnapshot | undefined>();

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public-dashboard')
      .then((response) => response.ok ? response.json() as Promise<PublicDashboardSnapshot> : undefined)
      .then((data) => {
        if (!cancelled && data) setSnapshot(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return snapshot;
}

export function usePersistedLeaderboardRows(fallback: LeaderboardRowView[]): LeaderboardRowView[] {
  const [rows, setRows] = useState<LeaderboardRowView[]>(fallback);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/leaderboard')
      .then((response) => response.ok ? response.json() as Promise<LeaderboardApiResponse> : undefined)
      .then((data) => {
        if (!cancelled && data?.entries?.length) setRows(data.entries.map(toLeaderboardRow));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return rows;
}

export function usePublicLeaderboardRow(playerId: string, fallback?: LeaderboardRowView): LeaderboardRowView | undefined {
  const rows = usePersistedLeaderboardRows(fallback ? [fallback] : []);
  return rows.find((row) => row.playerId === playerId) ?? fallback;
}

function toLeaderboardRow(entry: LeaderboardApiResponse['entries'][number]): LeaderboardRowView {
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
