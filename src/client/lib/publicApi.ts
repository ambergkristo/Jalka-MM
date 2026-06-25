import { useEffect, useState } from 'react';
import type { DashboardMatch, DashboardResult, GroupLeader, GroupStanding, TournamentStat, TournamentSummaryMetric, TournamentTopScorer } from '../data/mock.js';
import type { BracketTree } from '../../domain/publicBracket.js';
import type { CountyLeaderboardRow } from '../../domain/countyLeaderboard.js';
import { buildLeaderboardRows, buildPublicTournamentState, selectLiveMatchSection, selectPublicMatchSection, type PublicDashboardSnapshotLike, type PublicTournamentState } from './publicTournamentState.js';
import type { LeaderboardRowView } from './predictionViewModels.js';

export interface PublicDashboardSnapshot extends PublicDashboardSnapshotLike {
}

export interface PublicDashboardLoadState {
  snapshot?: PublicDashboardSnapshot;
  error?: string;
}

interface PublicDashboardApiResponse {
  completedMatchesCount?: number;
  totalMatchesCount?: number;
  liveMatches: DashboardMatch[];
  todayMatches: DashboardMatch[];
  upcomingMatches: DashboardMatch[];
  latestResults: DashboardResult[];
  groupStandings: GroupStanding[];
  groupLeaders: GroupLeader[];
  topScorers: TournamentTopScorer[];
  playoffBracket: BracketTree;
  tournamentSummary: TournamentSummaryMetric[];
  tournamentStats: TournamentStat[];
  tournamentProgressByStage: Array<{ stage: string; completed: number; total: number }>;
  leaderboard: PublicDashboardSnapshotLike['leaderboard'];
  countyLeaderboard?: CountyLeaderboardRow[];
}

export function usePublicDashboardSnapshot(refreshIntervalMs = 60_000): PublicDashboardLoadState {
  const [snapshot, setSnapshot] = useState<PublicDashboardSnapshot | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const loadSnapshot = async () => {
      try {
        const response = await fetch('/api/public-dashboard', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) {
          const body = await response.text().catch(() => '');
          const message = `Public dashboard fetch failed (${response.status} ${response.statusText || 'error'}${body ? `: ${body}` : ''})`;
          console.error(message);
          if (!cancelled) setError(message);
          return;
        }
        const data = await response.json() as PublicDashboardApiResponse;
        if (!cancelled) {
          setSnapshot(data);
          setError(undefined);
        }
      } catch (error) {
        const message = error instanceof Error ? `Public dashboard fetch failed: ${error.message}` : 'Public dashboard fetch failed.';
        console.error(message, error);
        if (!cancelled) setError(message);
      }
    };

    void loadSnapshot();
    const interval = window.setInterval(() => {
      void loadSnapshot();
    }, refreshIntervalMs);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [refreshIntervalMs]);

  return { snapshot, error };
}

export function usePublicTournamentState(refreshIntervalMs = 60_000): PublicTournamentState {
  const { snapshot, error } = usePublicDashboardSnapshot(refreshIntervalMs);
  return {
    ...buildPublicTournamentState(snapshot),
    snapshotError: error
  };
}

export function usePersistedLeaderboardRows(fallback: LeaderboardRowView[]): LeaderboardRowView[] {
  const { leaderboardRows } = usePublicTournamentState();
  return leaderboardRows.length > 0 ? leaderboardRows : fallback;
}

export function usePublicLeaderboardRow(playerId: string, fallback?: LeaderboardRowView): LeaderboardRowView | undefined {
  const rows = usePublicTournamentState().leaderboardRows;
  return rows.find((row) => row.playerId === playerId) ?? fallback;
}

export function buildCanonicalMatchSection(snapshot: PublicDashboardSnapshot | undefined, now = new Date(), limit = 3) {
  return selectPublicMatchSection(snapshot, now, limit);
}

export function buildCanonicalLiveMatchSection(snapshot: PublicDashboardSnapshot | undefined, limit = 3) {
  return selectLiveMatchSection(snapshot, limit);
}

export function buildCanonicalLeaderboardRows(snapshot: PublicDashboardSnapshot | undefined): LeaderboardRowView[] {
  return buildLeaderboardRows(snapshot);
}
