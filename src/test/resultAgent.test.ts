import { describe, expect, it } from 'vitest';
import { InMemoryResultRepository, createDefaultMockMatches } from '../server/results/inMemoryResultRepository.js';
import { rebuildLeaderboardAfterFinalResult } from '../server/results/leaderboardRebuild.js';
import { MockResultProvider } from '../server/results/mockResultProvider.js';
import { runResultUpdateCycle } from '../server/results/resultAgent.js';

describe('result agent update cycle', () => {
  it('checks due matches, saves updates, and rebuilds leaderboard after final changes', async () => {
    const now = new Date('2026-06-15T18:00:00.000Z');
    const repository = new InMemoryResultRepository(createDefaultMockMatches(now));
    const summary = await runResultUpdateCycle({
      repository,
      provider: new MockResultProvider(),
      now
    });

    expect(summary.provider).toBe('mock-result-provider');
    expect(summary.mode).toBe('mock');
    expect(summary.checkedMatches).toBeGreaterThan(0);
    expect(summary.updatesApplied).toBe(summary.checkedMatches);
    expect(summary.finalizedResults).toBe(1);
    expect(summary.leaderboardRebuilds).toHaveLength(1);
    expect(summary.leaderboardRebuilds[0]).toMatchObject({
      playersProcessed: 24,
      matchesProcessed: 1,
      entries: expect.any(Array),
      warnings: []
    });
    expect(summary.leaderboardRebuilds[0].entries[0]).toMatchObject({ points: 3, exactScores: 1, correctResults: 1 });
  });
});

describe('leaderboard rebuild', () => {
  it('returns recalculated leaderboard entries from seed predictions and finalized results', async () => {
    const result = await rebuildLeaderboardAfterFinalResult({
      now: new Date('2026-06-15T18:00:00.000Z'),
      finalizedResults: [
        {
          matchId: 4,
          status: 'FINISHED',
          homeScore: 2,
          awayScore: 1,
          isFinal: true,
          lastCheckedAt: '2026-06-15T18:00:00.000Z',
          provider: 'mock-result-provider'
        }
      ]
    });
    expect(result.recalculatedAt).toBe('2026-06-15T18:00:00.000Z');
    expect(result.playersProcessed).toBe(24);
    expect(result.matchesProcessed).toBe(1);
    expect(result.warnings).toEqual([]);
    expect(result.entries[0]).toMatchObject({ rank: 1, points: 3, exactScores: 1, correctResults: 1 });
  });
});
