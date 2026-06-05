import { describe, expect, it } from 'vitest';
import { InMemoryResultRepository, createDefaultMockMatches } from '../server/results/inMemoryResultRepository.js';
import { rebuildLeaderboardAfterFinalResult } from '../server/results/leaderboardRebuild.js';
import { MockResultProvider } from '../server/results/mockResultProvider.js';
import { runResultUpdateCycle } from '../server/results/resultAgent.js';

describe('result agent update cycle', () => {
  it('keeps first final observation provisional and rebuilds only after delayed confirmation', async () => {
    const now = new Date('2026-06-15T18:00:00.000Z');
    const repository = new InMemoryResultRepository(createDefaultMockMatches(now));
    const first = await runResultUpdateCycle({
      repository,
      provider: new MockResultProvider(),
      now,
      confirmationDelayMinutes: 10
    });

    expect(first.provider).toBe('mock-result-provider');
    expect(first.mode).toBe('mock');
    expect(first.checkedMatches).toBeGreaterThan(0);
    expect(first.updatesApplied).toBe(first.checkedMatches);
    expect(first.finalizedResults).toBe(0);
    expect(first.confirmationPending).toBe(1);
    expect(first.leaderboardRebuilt).toBe(false);
    expect(first.leaderboardRebuilds).toHaveLength(0);

    const second = await runResultUpdateCycle({
      repository,
      provider: new MockResultProvider(),
      now: new Date('2026-06-15T18:11:00.000Z'),
      confirmationDelayMinutes: 10
    });

    expect(second.finalizedResults).toBe(1);
    expect(second.confirmationPending).toBe(0);
    expect(second.leaderboardRebuilds).toHaveLength(1);
    expect(second.leaderboardRebuilds[0]).toMatchObject({
      playersProcessed: 24,
      matchesProcessed: 1,
      entries: expect.any(Array),
      warnings: [
        'Group bonus points were skipped because actual group standings are not available.',
        'Playoff bonus points were skipped because actual knockout results are not available.',
        'Top scorer bonus points were skipped because actual top scorer data is not available.'
      ]
    });
    expect(second.leaderboardRebuilds[0].entries[0]).toMatchObject({ points: 6, exactScores: 1, correctResults: 1 });
  });

  it('dry-run checks provider updates without saving results or leaderboard rows', async () => {
    const now = new Date('2026-06-15T18:00:00.000Z');
    const repository = new InMemoryResultRepository(createDefaultMockMatches(now));
    const summary = await runResultUpdateCycle({
      repository,
      provider: new MockResultProvider(),
      now,
      dryRun: true
    });

    expect(summary).toMatchObject({
      dryRun: true,
      checkedMatches: expect.any(Number),
      updatesApplied: 0,
      updatedMatches: 0,
      finalizedResults: 0,
      confirmationPending: 0,
      needsReview: 0,
      leaderboardRebuilt: false,
      warnings: ['Dry run completed without persisting result, run summary, or leaderboard changes.']
    });
    expect(summary.checkedMatches).toBeGreaterThan(0);
    await expect(repository.getFinalizedResults()).resolves.toEqual([]);
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
    expect(result.warnings).toEqual([
      'Group bonus points were skipped because actual group standings are not available.',
      'Playoff bonus points were skipped because actual knockout results are not available.',
      'Top scorer bonus points were skipped because actual top scorer data is not available.'
    ]);
    expect(result.entries[0]).toMatchObject({ rank: 1, points: 6, exactScores: 1, correctResults: 1 });
  });
});
