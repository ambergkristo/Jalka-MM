import { describe, expect, it } from 'vitest';
import { InMemoryResultRepository, createDefaultMockMatches } from '../server/results/inMemoryResultRepository.js';
import { rebuildLeaderboardAfterFinalResult } from '../server/results/leaderboardRebuild.js';
import { MockResultProvider } from '../server/results/mockResultProvider.js';
import { ProviderChainResultProvider } from '../server/results/providerChainResultProvider.js';
import { getResultAgentStatus, runResultUpdateCycle } from '../server/results/resultAgent.js';
import { toResultUpdate, type ResultProvider } from '../server/results/resultProvider.js';

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
      observationsProcessed: expect.any(Number),
      updatesApplied: 0,
      updatedMatches: 0,
      finalizedResults: 0,
      confirmationPending: 0,
      needsReview: 0,
      leaderboardRebuilt: false,
      warnings: expect.arrayContaining(['Dry run completed without persisting result, run summary, or leaderboard changes.'])
    });
    expect(summary.checkedMatches).toBeGreaterThan(0);
    expect(summary.observationsProcessed).toBeGreaterThan(0);
    expect(summary.finalObservations + summary.provisionalObservations + summary.liveObservations + summary.scheduledObservations).toBeGreaterThan(0);
    await expect(repository.getFinalizedResults()).resolves.toEqual([]);
  });

  it('confirms immediately when two chained providers agree on a final score', async () => {
    const now = new Date('2026-06-15T18:00:00.000Z');
    const repository = new InMemoryResultRepository(createDefaultMockMatches(now).filter((match) => match.id === 4));
    const provider = new ProviderChainResultProvider([
      finalProvider('api-football-result-provider', 2, 1),
      finalProvider('football-data-result-provider', 2, 1)
    ]);

    const summary = await runResultUpdateCycle({ repository, provider, now });

    expect(summary.finalizedResults).toBe(1);
    expect(summary.confirmationPending).toBe(0);
    expect(summary.needsReview).toBe(0);
    expect(summary.leaderboardRebuilt).toBe(true);
    const finalized = await repository.getFinalizedResults();
    expect(finalized[0]).toMatchObject({
      isFinal: true,
      publicStatus: 'CONFIRMED_FINAL',
      confirmationConfidence: 'provider-agreement',
      confirmationSource: 'api-football-result-provider+football-data-result-provider'
    });
  });

  it('marks needs review and skips leaderboard rebuild when chained providers disagree', async () => {
    const now = new Date('2026-06-15T18:00:00.000Z');
    const repository = new InMemoryResultRepository(createDefaultMockMatches(now).filter((match) => match.id === 4));
    const provider = new ProviderChainResultProvider([
      finalProvider('api-football-result-provider', 2, 1),
      finalProvider('football-data-result-provider', 1, 1)
    ]);

    const summary = await runResultUpdateCycle({ repository, provider, now });

    expect(summary.finalizedResults).toBe(0);
    expect(summary.needsReview).toBe(1);
    expect(summary.leaderboardRebuilt).toBe(false);
    expect(summary.warnings).toContain('Provider final scores disagree for match 4.');
  });

  it('does not confirm a non-final open-worldcup observation in live mode', async () => {
    const now = new Date('2026-06-11T19:30:00.000Z');
    const repository = new InMemoryResultRepository([{
      id: 1,
      kickoffUtc: '2026-06-11T19:00:00.000Z',
      status: 'SCHEDULED',
      homeTeam: 'Mexico',
      awayTeam: 'South Africa',
      isFinal: false
    }]);
    const provider: ResultProvider = {
      name: 'open-worldcup-result-provider',
      mode: 'live' as const,
      async fetchMatchUpdate(match, now) {
        return toResultUpdate({
          match,
          provider: 'open-worldcup-result-provider',
          providerStatus: 'LIVE',
          now,
          homeScore: 1,
          awayScore: 0,
          minute: 30,
          providerMatchId: '1'
        });
      }
    };

    const summary = await runResultUpdateCycle({ repository, provider, now });

    expect(summary).toMatchObject({
      finalizedResults: 0,
      confirmationPending: 0,
      needsReview: 0,
      leaderboardRebuilt: false
    });
    await expect(repository.getFinalizedResults()).resolves.toHaveLength(0);
  });

  it('returns a safe operational status summary without secrets', async () => {
    const now = new Date('2026-06-15T18:00:00.000Z');
    const repository = new InMemoryResultRepository(createDefaultMockMatches(now).filter((match) => match.id === 4));
    await repository.saveResultUpdate({
      matchId: 4,
      status: 'FINISHED',
      publicStatus: 'CONFIRMED_FINAL',
      homeScore: 2,
      awayScore: 1,
      isFinal: true,
      lastCheckedAt: now.toISOString(),
      provider: 'open-worldcup-result-provider',
      confirmedHomeScore: 2,
      confirmedAwayScore: 1,
      confirmedAt: now.toISOString(),
      confirmationSource: 'manual',
      confirmationConfidence: 'manual'
    });
    await repository.saveRunSummary({
      startedAt: '2026-06-15T17:55:00.000Z',
      finishedAt: now.toISOString(),
      checkedMatches: 1,
      observationsProcessed: 1,
      updatesApplied: 1,
      finalizedResults: 1,
      dryRun: false,
      updatedMatches: 1,
      finalizedMatches: 1,
      wouldConfirm: 1,
      wouldNeedsReview: 0,
      finalObservations: 1,
      provisionalObservations: 0,
      liveObservations: 0,
      scheduledObservations: 0,
      confirmationPending: 0,
      needsReview: 0,
      leaderboardRebuilt: true,
      playersProcessed: 24,
      warnings: ['Dry run completed without persisting result, run summary, or leaderboard changes.'],
      leaderboardRebuilds: [],
      lastRunAt: now.toISOString(),
      nextSuggestedRunAt: now.toISOString(),
      staleMatchesCount: 0,
      provider: 'open-worldcup-result-provider',
      mode: 'live'
    });

    const status = await getResultAgentStatus({ repository, provider: new MockResultProvider(), now });

    expect(status).toMatchObject({
      provider: 'mock-result-provider',
      mode: 'mock',
      staleMatchesCount: expect.any(Number),
      latestConfirmedResultCount: 1,
      pendingWarningsCount: 1,
      providerReachable: true,
      lastRunSummary: expect.objectContaining({
        checkedMatches: 1,
        updatedMatches: 1,
        finalizedMatches: 1,
        warningsCount: 1
      })
    });
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

function finalProvider(name: string, homeScore: number, awayScore: number): ResultProvider {
  return {
    name,
    mode: 'live',
    async fetchMatchUpdate(match, now) {
      return toResultUpdate({
        match,
        provider: name,
        providerStatus: 'finished',
        now,
        homeScore,
        awayScore,
        minute: 90
      });
    }
  };
}
