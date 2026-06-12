import { useEffect, useState } from 'react';
import type { DashboardMatch, DashboardResult, GroupLeader, GroupStanding, TournamentStat, TournamentSummaryMetric, TournamentTopScorer } from '../data/mock.js';
import type { BracketTree } from '../../domain/publicBracket.js';
import { buildLeaderboardRows, buildPublicTournamentState, selectPublicMatchSection, type PublicDashboardSnapshotLike, type PublicTournamentState } from './publicTournamentState.js';
import type { LeaderboardRowView } from './predictionViewModels.js';

export interface PublicDashboardSnapshot extends PublicDashboardSnapshotLike {
}

interface PublicDashboardApiResponse {
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
}

export function usePublicDashboardSnapshot(): PublicDashboardSnapshot | undefined {
  const [snapshot, setSnapshot] = useState<PublicDashboardSnapshot | undefined>();

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public-dashboard')
      .then((response) => response.ok ? response.json() as Promise<PublicDashboardApiResponse> : undefined)
      .then((data) => {
        if (!cancelled && data) {
          setSnapshot(data);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return snapshot;
}

export function usePublicTournamentState(): PublicTournamentState {
  return buildPublicTournamentState(usePublicDashboardSnapshot());
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

export function buildCanonicalLeaderboardRows(snapshot: PublicDashboardSnapshot | undefined): LeaderboardRowView[] {
  return buildLeaderboardRows(snapshot);
}
