import { describe, expect, it, vi } from 'vitest';
import { InMemoryResultRepository, createDefaultMockMatches } from '../server/results/inMemoryResultRepository.js';
import { rebuildLeaderboardAfterFinalResult } from '../server/results/leaderboardRebuild.js';
import { leaderboardNeedsRepair, reconcileLeaderboardEntries } from '../server/results/leaderboardProjection.js';
import { MockResultProvider } from '../server/results/mockResultProvider.js';
import { ProviderChainResultProvider } from '../server/results/providerChainResultProvider.js';
import { getResultAgentStatus, runResultUpdateCycle } from '../server/results/resultAgent.js';
import { toResultUpdate, type ResultProvider } from '../server/results/resultProvider.js';
import type { ResultUpdate } from '../server/results/resultTypes.js';
import { predictionRepository, type LeaderboardEntry } from '../domain/predictionRepository.js';

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
      playersProcessed: 109,
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

  it('syncs live scorer facts without finalizing results or rebuilding leaderboard scores', async () => {
    const now = new Date('2026-06-11T19:30:00.000Z');
    const repository = new InMemoryResultRepository([{
      id: 1,
      kickoffUtc: '2026-06-11T19:00:00.000Z',
      status: 'SCHEDULED',
      homeTeam: 'Mexico',
      awayTeam: 'South Africa',
      isFinal: false
    }]) as InMemoryResultRepository & {
      syncConfirmedScorersForMatch: (matchId: number, scorers: NonNullable<ResultUpdate['scorers']>, timestamp: string) => Promise<void>;
    };
    repository.syncConfirmedScorersForMatch = vi.fn(async () => undefined);
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
          providerMatchId: '1',
          scorers: [
            { playerName: 'Santiago Gimenez', teamName: 'Mexico', goals: 1 }
          ]
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
    expect(repository.syncConfirmedScorersForMatch).toHaveBeenCalledWith(1, [
      { playerName: 'Santiago Gimenez', teamName: 'Mexico', goals: 1 }
    ], now.toISOString());
    await expect(repository.getFinalizedResults()).resolves.toHaveLength(0);
  });

  it('syncs scorer facts when a confirmed result includes scorer data', async () => {
    const now = new Date('2026-06-11T21:30:00.000Z');
    const repository = new InMemoryResultRepository([{
      id: 1,
      kickoffUtc: '2026-06-11T19:00:00.000Z',
      status: 'SCHEDULED',
      homeTeam: 'Mexico',
      awayTeam: 'South Africa',
      isFinal: false
    }]) as InMemoryResultRepository & {
      syncConfirmedScorersForMatch: (matchId: number, scorers: NonNullable<ResultUpdate['scorers']>, timestamp: string) => Promise<void>;
    };
    repository.syncConfirmedScorersForMatch = vi.fn(async () => undefined);
    const provider: ResultProvider = {
      name: 'open-worldcup-result-provider',
      mode: 'live' as const,
      async fetchMatchUpdate(match, now) {
        return toResultUpdate({
          match,
          provider: 'open-worldcup-result-provider',
          providerStatus: 'FINISHED',
          now,
          homeScore: 2,
          awayScore: 0,
          minute: 90,
          providerMatchId: '1',
          scorers: [
            { playerName: 'Rui Costa', teamName: 'Mexico', goals: 2 }
          ]
        });
      }
    };

    const first = await runResultUpdateCycle({ repository, provider, now, confirmationDelayMinutes: 10 });
    const summary = await runResultUpdateCycle({
      repository,
      provider,
      now: new Date('2026-06-11T21:41:00.000Z'),
      confirmationDelayMinutes: 10
    });

    expect(first.finalizedResults).toBe(0);
    expect(summary.finalizedResults).toBe(1);
    expect(repository.syncConfirmedScorersForMatch).toHaveBeenCalledWith(1, [
      { playerName: 'Rui Costa', teamName: 'Mexico', goals: 2 }
    ], new Date('2026-06-11T21:41:00.000Z').toISOString());
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
      playersProcessed: 109,
      warnings: ['Dry run completed without persisting result, run summary, or leaderboard changes.'],
      warningDetails: [{
        internalMatchId: 4,
        providerFixtureId: '4',
        homeTeam: 'Argentina',
        awayTeam: 'Korea Republic',
        kickoffAt: '2026-06-15T16:00:00.000Z',
        providerStatus: 'FINISHED',
        normalizedStatus: 'FINISHED',
        providerScore: '2-1',
        reason: 'Final result for match 4 is pending confirmation before public scoring.',
        action: 'pending-confirmation'
      }],
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
      lastRunWarnings: [{
        internalMatchId: 4,
        providerFixtureId: '4',
        homeTeam: 'Argentina',
        awayTeam: 'Korea Republic',
        kickoffAt: '2026-06-15T16:00:00.000Z',
        providerStatus: 'FINISHED',
        normalizedStatus: 'FINISHED',
        providerScore: '2-1',
        reason: 'Final result for match 4 is pending confirmation before public scoring.',
        action: 'pending-confirmation'
      }],
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
    expect(result.playersProcessed).toBe(109);
    expect(result.matchesProcessed).toBe(1);
    expect(result.warnings).toEqual([
      'Group bonus points were skipped because actual group standings are not available.',
      'Playoff bonus points were skipped because actual knockout results are not available.',
      'Top scorer bonus points were skipped because actual top scorer data is not available.'
    ]);
    expect(result.entries[0]).toMatchObject({ rank: 1, points: 6, exactScores: 1, correctResults: 1 });
  });

  it('repairs stale persisted leaderboard rows by scoring all canonical players against confirmed results', async () => {
    const staleEntries = predictionRepository.getLeaderboard().slice(0, 24).map((entry, index) => leaderboardRow({
      playerId: entry.playerId,
      rank: index + 1,
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
      previousRank: entry.rank
    }));
    const leaderboardRepository = {
      async getLeaderboard() {
        return staleEntries;
      },
      async getLeaderboardMetadata() {
        return {
          lastRebuildAt: '2026-06-15T18:00:00.000Z',
          playersProcessed: staleEntries.length,
          matchesProcessed: 1,
          changedEntries: 0,
          warnings: []
        };
      },
      async getFinalizedResults() {
        return [{
          matchId: 1,
          status: 'FINISHED',
          homeScore: 2,
          awayScore: 0,
          isFinal: true,
          lastCheckedAt: '2026-06-15T18:00:00.000Z',
          provider: 'mock-result-provider'
        }];
      }
    };

    const current = await reconcileLeaderboardEntries({
      persistedEntries: staleEntries,
      finalizedResults: await leaderboardRepository.getFinalizedResults(),
      now: new Date('2026-06-15T18:00:00.000Z')
    });
    const ruiCosta = current?.entries.find((entry) => entry.playerId === 'rui-costa');
    const lastEntry = current?.entries.at(-1);

    expect(current?.entries).toHaveLength(109);
    expect(current?.entries.some((entry) => entry.points > 0)).toBe(true);
    expect(ruiCosta).toMatchObject({
      points: 6,
      exactScores: 1,
      correctResults: 1,
      matchesScored: 1
    });
    expect(current && leaderboardNeedsRepair(staleEntries, current.entries)).toBe(true);
    expect(current?.entries.findIndex((entry) => entry.points === 0)).toBeGreaterThan(0);
    expect(lastEntry?.points).toBe(0);
  });
});

function leaderboardRow(input: Partial<LeaderboardEntry> & Pick<LeaderboardEntry, 'playerId'>): LeaderboardEntry {
  return {
    playerId: input.playerId,
    rank: input.rank ?? 0,
    points: input.points ?? 0,
    exactScores: input.exactScores ?? 0,
    correctResults: input.correctResults ?? 0,
    hitRate: input.hitRate ?? 0,
    matchesScored: input.matchesScored ?? 0,
    matchPoints: input.matchPoints ?? input.points ?? 0,
    groupBonusPoints: input.groupBonusPoints ?? 0,
    playoffBonusPoints: input.playoffBonusPoints ?? 0,
    topScorerBonusPoints: input.topScorerBonusPoints ?? 0,
    totalPoints: input.totalPoints ?? input.points ?? 0,
    previousRank: input.previousRank,
    lastUpdatedAt: input.lastUpdatedAt ?? ''
  };
}

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
