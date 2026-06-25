import { describe, expect, it, vi } from 'vitest';
import type { LeaderboardEntry, PlayerMatchPrediction } from '../domain/predictionRepository.js';

vi.mock('../domain/predictionRepository.js', () => {
  const players = [
    { id: 'jurgen-perov-jung', name: 'Jürgen Perov-Jung' },
    { id: 'other-player', name: 'Other Player' }
  ];

  const matchPredictions: PlayerMatchPrediction[] = [
    ...Array.from({ length: 20 }, (_, index) => ({
      playerId: 'jurgen-perov-jung',
      matchId: index + 1,
      homeScore: 2,
      awayScore: 1
    })),
    {
      playerId: 'jurgen-perov-jung',
      matchId: 21,
      homeScore: 3,
      awayScore: 2
    }
  ];

  const knockoutPredictions = [
    {
      playerId: 'jurgen-perov-jung',
      rounds: [{ round: 'R16', teams: ['Bonus FC'] }]
    }
  ];

  const awardsPredictions = [
    {
      playerId: 'jurgen-perov-jung',
      championTeam: 'Other FC',
      championStatus: 'Still alive',
      topScorerName: 'Someone Else',
      topScorerTeam: 'Other FC',
      topScorerCurrentGoals: 0,
      topScorerStatus: 'In chase'
    }
  ];

  const leaderboard: LeaderboardEntry[] = [
    {
      playerId: 'jurgen-perov-jung',
      rank: 1,
      points: 122,
      exactScores: 20,
      correctResults: 21,
      hitRate: 1,
      matchesScored: 21,
      matchPoints: 122,
      groupBonusPoints: 0,
      playoffBonusPoints: 0,
      topScorerBonusPoints: 0,
      totalPoints: 122,
      previousRank: 1,
      lastUpdatedAt: '2026-06-24T22:29:33.518Z'
    },
    {
      playerId: 'other-player',
      rank: 2,
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
      previousRank: 2,
      lastUpdatedAt: '2026-06-24T22:29:33.518Z'
    }
  ];

  return {
    predictionRepository: {
      getPlayers: () => players,
      getMatchPredictions: () => matchPredictions,
      getGroupPredictions: () => [],
      getKnockoutPredictions: () => knockoutPredictions,
      getAwardsPredictions: () => awardsPredictions,
      getLeaderboard: () => leaderboard
    }
  };
});

import { repairPersistedLeaderboardSnapshot } from '../server/results/leaderboardRepair.js';
import type { ActualScoringState } from '../server/results/scoringState.js';

describe('leaderboard snapshot repair', () => {
  it('rebuilds a stale persisted 122-point row to 137 when bonus state is available', async () => {
    const persistedEntries: LeaderboardEntry[] = [
      {
        playerId: 'jurgen-perov-jung',
        rank: 1,
        points: 122,
        exactScores: 20,
        correctResults: 21,
        hitRate: 1,
        matchesScored: 21,
        matchPoints: 122,
        groupBonusPoints: 0,
        playoffBonusPoints: 0,
        topScorerBonusPoints: 0,
        totalPoints: 122,
        previousRank: 1,
        lastUpdatedAt: '2026-06-24T22:29:33.518Z'
      },
      {
        playerId: 'other-player',
        rank: 2,
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
        previousRank: 2,
        lastUpdatedAt: '2026-06-24T22:29:33.518Z'
      }
    ];

    const actualScoringState: ActualScoringState = {
      actualKnockoutResults: {
        stageTeams: {
          R16: ['Bonus FC']
        }
      }
    };

    const replaceLeaderboard = vi.fn(async () => undefined);
    const leaderboardRepository = {
      async getLeaderboard() {
        return persistedEntries;
      },
      async replaceLeaderboard(entries: LeaderboardEntry[]) {
        replaceLeaderboard(entries);
      },
      async getLeaderboardMetadata() {
        return {
          lastRebuildAt: '2026-06-24T22:29:33.518Z',
          playersProcessed: 2,
          matchesProcessed: 21,
          changedEntries: 0,
          warnings: []
        };
      },
      async getFinalizedResults() {
        return Array.from({ length: 21 }, (_, index) => ({
          matchId: index + 1,
          status: 'FINISHED' as const,
          homeScore: index === 20 ? 2 : 2,
          awayScore: index === 20 ? 0 : 1,
          isFinal: true,
          lastCheckedAt: '2026-06-24T22:29:33.518Z',
          provider: 'mock-result-provider'
        }));
      }
    };

    const finalizedResults = await leaderboardRepository.getFinalizedResults();
    const rebuilt = await repairPersistedLeaderboardSnapshot({
      leaderboardRepository,
      persistedEntries,
      finalizedResults,
      actualScoringState,
      now: new Date('2026-06-24T22:29:33.518Z')
    });

    expect(rebuilt?.entries[0]).toMatchObject({
      playerId: 'jurgen-perov-jung',
      matchPoints: 122,
      playoffBonusPoints: 15,
      totalPoints: 137
    });
    expect(replaceLeaderboard).toHaveBeenCalledTimes(1);
    expect(replaceLeaderboard).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          playerId: 'jurgen-perov-jung',
          totalPoints: 137,
          playoffBonusPoints: 15,
          matchPoints: 122
        })
      ])
    );
  });

  it('removes an early top-scorer bonus from a persisted row when the tournament top scorer is not final yet', async () => {
    const persistedEntries: LeaderboardEntry[] = [
      {
        playerId: 'jurgen-perov-jung',
        rank: 1,
        points: 187,
        exactScores: 20,
        correctResults: 21,
        hitRate: 1,
        matchesScored: 21,
        matchPoints: 122,
        groupBonusPoints: 0,
        playoffBonusPoints: 15,
        topScorerBonusPoints: 50,
        totalPoints: 187,
        previousRank: 1,
        lastUpdatedAt: '2026-06-24T22:29:33.518Z'
      },
      {
        playerId: 'other-player',
        rank: 2,
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
        previousRank: 2,
        lastUpdatedAt: '2026-06-24T22:29:33.518Z'
      }
    ];

    const actualScoringState: ActualScoringState = {
      actualKnockoutResults: {
        stageTeams: {
          R16: ['Bonus FC']
        }
      },
      actualTopScorers: []
    };

    const replaceLeaderboard = vi.fn(async () => undefined);
    const leaderboardRepository = {
      async getLeaderboard() {
        return persistedEntries;
      },
      async replaceLeaderboard(entries: LeaderboardEntry[]) {
        replaceLeaderboard(entries);
      },
      async getLeaderboardMetadata() {
        return {
          lastRebuildAt: '2026-06-24T22:29:33.518Z',
          playersProcessed: 2,
          matchesProcessed: 21,
          changedEntries: 0,
          warnings: []
        };
      },
      async getFinalizedResults() {
        return Array.from({ length: 21 }, (_, index) => ({
          matchId: index + 1,
          status: 'FINISHED' as const,
          homeScore: index === 20 ? 2 : 2,
          awayScore: index === 20 ? 0 : 1,
          isFinal: true,
          lastCheckedAt: '2026-06-24T22:29:33.518Z',
          provider: 'mock-result-provider'
        }));
      }
    };

    const rebuilt = await repairPersistedLeaderboardSnapshot({
      leaderboardRepository,
      persistedEntries,
      finalizedResults: await leaderboardRepository.getFinalizedResults(),
      actualScoringState,
      now: new Date('2026-06-24T22:29:33.518Z')
    });

    expect(rebuilt?.entries[0]).toMatchObject({
      playerId: 'jurgen-perov-jung',
      matchPoints: 122,
      playoffBonusPoints: 15,
      topScorerBonusPoints: 0,
      totalPoints: 137
    });
    expect(replaceLeaderboard).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          playerId: 'jurgen-perov-jung',
          totalPoints: 137,
          topScorerBonusPoints: 0
        })
      ])
    );
  });
});
