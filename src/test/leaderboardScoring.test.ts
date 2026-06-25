import { describe, expect, it, vi } from 'vitest';
import type { LeaderboardEntry, PlayerMatchPrediction } from '../domain/predictionRepository.js';

vi.mock('../domain/predictionRepository.js', () => {
  const players = [
    { id: 'player-1', name: 'Player One' },
    { id: 'player-2', name: 'Player Two' }
  ];
  const matchPredictions: PlayerMatchPrediction[] = [
    { playerId: 'player-1', matchId: 1, homeScore: 2, awayScore: 1 },
    { playerId: 'player-2', matchId: 1, homeScore: 0, awayScore: 0 }
  ];
  const groupPredictions = [
    { playerId: 'player-1', group: 'A', first: 'Team A', second: 'Team B', third: 'Team C' }
  ];

  return {
    predictionRepository: {
      getPlayers: () => players,
      getMatchPredictions: (playerId?: string) => matchPredictions.filter((row) => !playerId || row.playerId === playerId),
      getGroupPredictions: (playerId?: string) => groupPredictions.filter((row) => !playerId || row.playerId === playerId),
      getKnockoutPredictions: () => [],
      getAwardsPredictions: () => [],
      getLeaderboard: () => []
    }
  };
});

import { buildLeaderboardScoringBreakdown } from '../server/results/leaderboardScoring.js';
import type { LeaderboardRepository } from '../server/results/leaderboardRepository.js';
import type { QueryableDatabase } from '../server/databaseAdapter.js';
import type { ResultsAgentRepository } from '../server/results/resultTypes.js';

describe('leaderboard scoring breakdown', () => {
  it('uses confirmed scores as the canonical scoring source and exposes the current bonus buckets', async () => {
    const resultsRepository: ResultsAgentRepository = {
      async listTrackedMatches() {
        return [{
          id: 1,
          kickoffUtc: '2026-06-25T10:00:00.000Z',
          status: 'FINISHED',
          homeTeam: 'Team A',
          awayTeam: 'Team B',
          isFinal: true
        }];
      },
      async getMatchResult() {
        return undefined;
      },
      async getProviderResultObservations() {
        return [];
      },
      async saveResultUpdate() {
        return { finalResultChanged: false };
      },
      async getFinalizedResults() {
        return [{
          matchId: 1,
          status: 'FINISHED',
          publicStatus: 'CONFIRMED_FINAL',
          homeScore: 0,
          awayScore: 0,
          confirmedHomeScore: 2,
          confirmedAwayScore: 1,
          isFinal: true,
          lastCheckedAt: '2026-06-25T10:00:00.000Z',
          confirmedAt: '2026-06-25T10:00:00.000Z',
          provider: 'mock-result-provider'
        }];
      },
      async getStatus() {
        throw new Error('not used');
      },
      async markPointsRecalculated() {},
      async saveRunSummary() {}
    };
    const leaderboardRepository: LeaderboardRepository = {
      async getLeaderboard() {
        return [{
          playerId: 'player-1',
          rank: 1,
          points: 0,
          exactScores: 0,
          correctResults: 0,
          hitRate: 0,
          matchesScored: 0,
          matchPoints: 0,
          groupBonusPoints: 0,
          playoffBonusPoints: 0,
          topScorerBonusPoints: 0,
          totalPoints: 0,
          previousRank: 1,
          lastUpdatedAt: '2026-06-25T09:00:00.000Z'
        } satisfies LeaderboardEntry];
      },
      async replaceLeaderboard() {},
      async getLeaderboardMetadata() {
        return {
          lastRebuildAt: '2026-06-25T09:00:00.000Z',
          playersProcessed: 2,
          matchesProcessed: 1,
          changedEntries: 1,
          warnings: []
        };
      }
    };
    const database: QueryableDatabase = {
      provider: 'sqlite',
      async run() {},
      async all() {
        return [];
      },
      async one() {
        return null;
      },
      async exec() {},
      async transaction<T>(callback: (tx: QueryableDatabase) => Promise<T>) {
        return callback(this);
      },
      async close() {}
    };

    const breakdown = await buildLeaderboardScoringBreakdown({
      database,
      resultsRepository,
      leaderboardRepository,
      playerQuery: 'player-1',
      now: new Date('2026-06-25T10:30:00.000Z'),
      actualScoringState: {
        actualGroupStandings: [
          { group: 'A', team: 'Team A', rank: 1, qualified: true },
          { group: 'A', team: 'Team B', rank: 2, qualified: true },
          { group: 'A', team: 'Team C', rank: 3, qualified: false },
          { group: 'A', team: 'Team D', rank: 4, qualified: false }
        ],
        actualTopScorers: []
      }
    });

    expect(breakdown.finalizedGroups).toEqual(['A']);
    expect(breakdown.persistedEntry).toMatchObject({ playerId: 'player-1', totalPoints: 0 });
    expect(breakdown.rebuiltEntry).toMatchObject({
      playerId: 'player-1',
      matchPoints: 6,
      groupBonusPoints: 15,
      playoffBonusPoints: 0,
      topScorerBonusPoints: 0,
      totalPoints: 21
    });
    expect(breakdown.playerResult.groupBreakdown).toEqual([{
      group: 'A',
      winnerPoints: 10,
      secondPlacePoints: 5,
      qualifierPoints: 0,
      points: 15
    }]);
    expect(breakdown.matches).toEqual([expect.objectContaining({
      matchId: 1,
      predictedHomeScore: 2,
      predictedAwayScore: 1,
      actualHomeScore: 2,
      actualAwayScore: 1,
      rawHomeScore: 0,
      rawAwayScore: 0,
      points: 6,
      scoreSource: 'confirmed'
    })]);
  });
});
