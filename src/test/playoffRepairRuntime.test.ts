import matchesJson from '../data/worldcup2026/matches.json' with { type: 'json' };
import teamsJson from '../data/worldcup2026/teams.json' with { type: 'json' };
import groupStageResultsJson from './fixtures/final-group-stage-results.json' with { type: 'json' };
import { describe, expect, it, vi } from 'vitest';
import { InMemoryResultRepository } from '../server/results/inMemoryResultRepository.js';
import { repairPlayoffResultsWith } from '../server/results/resultAgentRuntime.js';
import type { ResultProvider, TrackedMatch } from '../server/results/resultTypes.js';
import { toResultUpdate } from '../server/results/resultProvider.js';

let activeDb: ReturnType<typeof fakeDatabase> | undefined;

vi.mock('node:sqlite', () => ({
  DatabaseSync: class {
    prepare() {
      return {
        run() {},
        all() {
          return [];
        },
        get() {
          return undefined;
        }
      };
    }

    exec() {}

    close() {}
  }
}));

vi.mock('pg', () => ({
  default: {
    Pool: class {
      query() {
        return Promise.resolve({ rows: [] });
      }

      connect() {
        return Promise.resolve({
          query: async () => ({ rows: [] }),
          release() {}
        });
      }

      end() {
        return Promise.resolve();
      }
    }
  }
}));

vi.mock('../server/results/playoffState.js', () => ({
  buildCanonicalPlayoffState: async () => ({
    generatedAt: '2026-06-29T06:05:00.000Z',
    fixtures: [
      {
        matchId: 73,
        stage: 'R32',
        kickoffAt: '2026-06-29T06:00:00.000Z',
        homeTeam: 'South Africa',
        awayTeam: 'Canada',
        homeTeamId: 'A2',
        awayTeamId: 'B1',
        status: 'finished',
        winnerTeamId: 'B1'
      }
    ],
    bracketFixturesByMatchId: new Map([
      [73, {
        matchId: 73,
        stage: 'R32',
        kickoffAt: '2026-06-29T06:00:00.000Z',
        homeTeam: 'South Africa',
        awayTeam: 'Canada',
        homeTeamId: 'A2',
        awayTeamId: 'B1',
        status: 'finished',
        winnerTeamId: 'B1'
      }]
    ]),
    groupStageComplete: true,
    confirmedGroupStageMatches: 72,
    r32FixturesKnownCount: 1,
    upcomingPlayoffFixturesCount: 0
  })
}));

vi.mock('../server/db.js', () => ({
  db: {
    get provider() {
      return activeDb?.provider ?? 'sqlite';
    },
    one: (...args: Parameters<ReturnType<typeof fakeDatabase>['one']>) => activeDb?.one(...args),
    all: (...args: Parameters<ReturnType<typeof fakeDatabase>['all']>) => activeDb?.all(...args),
    run: (...args: Parameters<ReturnType<typeof fakeDatabase>['run']>) => activeDb?.run(...args),
    exec: (...args: Parameters<ReturnType<typeof fakeDatabase>['exec']>) => activeDb?.exec(...args),
    transaction: (...args: Parameters<ReturnType<typeof fakeDatabase>['transaction']>) => activeDb?.transaction(...args)
  }
}));

const matches = matchesJson as Array<{
  id: number;
  stage: 'GROUP' | 'R32' | 'R16' | 'QF' | 'SF' | 'THIRD_PLACE' | 'FINAL';
  kickoffAt: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeSlot: string;
  awaySlot: string;
}>;
const teams = teamsJson as Array<{ id: string; name: string; nameEt?: string }>;
const groupStageResults = (groupStageResultsJson as {
  results: Array<{ matchId: number; homeScore: number; awayScore: number }>;
}).results;

describe.sequential('playoff repair runtime', () => {
  it('repairs a stuck playoff row, awaits rebuild, and exposes #73 diagnostics', async () => {
    const trackedMatches = matches.map(toTrackedMatch);
    const repository = new InMemoryResultRepository(trackedMatches);
    const refreshSpy = vi.fn(async () => ({
      recalculatedAt: new Date().toISOString(),
      playersProcessed: 109,
      matchesProcessed: 73,
      changedEntries: 1,
      entries: [],
      warnings: []
    }));
    (repository as InMemoryResultRepository & {
      refreshDerivedTournamentState: typeof refreshSpy;
    }).refreshDerivedTournamentState = refreshSpy;

    await seedConfirmedGroupResults(repository);
    await repository.saveResultUpdate({
      matchId: 73,
      providerMatchId: '73',
      status: 'FINISHED',
      publicStatus: 'CONFIRMING',
      homeScore: 0,
      awayScore: 1,
      provisionalHomeScore: 0,
      provisionalAwayScore: 1,
      provisionalStatus: 'FINISHED',
      isFinal: false,
      lastCheckedAt: '2026-06-29T05:55:00.000Z',
      nextCheckAt: '2026-06-29T08:00:00.000Z',
      provider: 'open-worldcup-result-provider',
      rawProviderStatus: 'FINISHED',
      confirmedHomeScore: undefined,
      confirmedAwayScore: undefined,
      providerResults: [],
      updatedAt: '2026-06-29T05:55:00.000Z',
      pointsRecalculatedAt: undefined
    });

    const provider: ResultProvider = {
      name: 'open-worldcup-result-provider',
      mode: 'live',
      async fetchMatchUpdate(match, now) {
        if (match.id === 73) {
          return toResultUpdate({
            match,
            provider: this.name,
            providerStatus: 'FINISHED',
            now,
            providerMatchId: '73',
            homeScore: 0,
            awayScore: 1,
            minute: 90
          });
        }

        return toResultUpdate({
          match,
          provider: this.name,
          providerStatus: 'SCHEDULED',
          now,
          providerMatchId: String(match.id)
        });
      }
    };

    activeDb = fakeDatabase(repository);
    const report = await repairPlayoffResultsWith({
      repository,
      leaderboardRepository: repository,
      provider,
      now: new Date('2026-06-29T06:05:00.000Z'),
      db: activeDb as never
    });

    expect(report.checked).toBeGreaterThan(0);
    expect(report.repaired).toBe(1);
    expect(refreshSpy).toHaveBeenCalled();
    expect(report.match73).toMatchObject({
      internalMatchId: 73,
      providerFixtureId: 73,
      providerStatus: 'FINISHED',
      providerScore: '0-1',
      storedStatus: 'CONFIRMED_FINAL',
      confirmedHomeScore: 0,
      confirmedAwayScore: 1,
      isConfirmedFinal: true,
      includedInPlayedCount: true,
      includedInLatestResults: true,
      canadaInR16: true,
      leaderboardRebuiltAfterRepair: true
    });

    const playedCount = Number((await activeDb!.one(`
      SELECT COUNT(*) AS count
      FROM match_results
      WHERE confirmed_home_score IS NOT NULL AND confirmed_away_score IS NOT NULL
    `))?.count ?? 0);
    expect(playedCount).toBe(73);

    const latestResults = await activeDb!.all(`
      SELECT m.id
      FROM match_results r
      JOIN matches m ON m.id = r.match_id
      WHERE r.confirmed_home_score IS NOT NULL AND r.confirmed_away_score IS NOT NULL
      ORDER BY COALESCE(r.confirmed_at, r.last_checked_at) DESC, m.id DESC
      LIMIT 8
    `);
    expect(latestResults.some((result) => Number(result.id) === 73)).toBe(true);
  });
});

function toTrackedMatch(match: (typeof matches)[number]): TrackedMatch {
  const homeTeam = teams.find((team) => team.id === match.homeTeamId);
  const awayTeam = teams.find((team) => team.id === match.awayTeamId);
  return {
    id: match.id,
    stage: match.stage,
    kickoffUtc: match.kickoffAt,
    providerMatchId: String(match.id),
    status: 'SCHEDULED',
    homeTeam: homeTeam?.nameEt ?? homeTeam?.name ?? match.homeSlot,
    awayTeam: awayTeam?.nameEt ?? awayTeam?.name ?? match.awaySlot,
    isFinal: false
  };
}

async function seedConfirmedGroupResults(repository: InMemoryResultRepository): Promise<void> {
  for (const result of groupStageResults) {
    await repository.saveResultUpdate({
      matchId: result.matchId,
      providerMatchId: String(result.matchId),
      status: 'FINISHED',
      publicStatus: 'CONFIRMED_FINAL',
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      isFinal: true,
      lastCheckedAt: '2026-06-28T00:00:00.000Z',
      confirmedHomeScore: result.homeScore,
      confirmedAwayScore: result.awayScore,
      confirmedAt: '2026-06-28T00:00:00.000Z',
      confirmationSource: 'official-scoresheet',
      confirmationConfidence: 'provider-repeat',
      provider: 'official-open-worldcup',
      rawProviderStatus: 'FINISHED',
      providerResults: [],
      updatedAt: '2026-06-28T00:00:00.000Z',
      pointsRecalculatedAt: undefined
    });
  }
}

function fakeDatabase(repository: InMemoryResultRepository) {
  return {
    provider: 'sqlite',
    async one(query: string) {
      if (/COUNT\(\*\) AS count[\s\S]*m\.stage = 'GROUP'/.test(query)) {
        return { count: (await repository.getFinalizedResults()).filter((result) => result.matchId <= 72).length };
      }
      if (/COUNT\(\*\) AS count[\s\S]*confirmed_home_score IS NOT NULL AND confirmed_away_score IS NOT NULL/.test(query)) {
        return { count: (await repository.getFinalizedResults()).length };
      }
      if (/FROM result_agent_runs/.test(query)) {
        return {
          started_at: '2026-06-29T06:05:00.000Z',
          finished_at: '2026-06-29T06:05:01.000Z',
          checked_matches: 32,
          finalized_matches: 1,
          leaderboard_rebuilt: 1,
          warnings_json: '[]'
        };
      }
      return null;
    },
    async all(query: string) {
      if (/ORDER BY COALESCE\(r\.confirmed_at, r\.last_checked_at\) DESC, m\.id DESC/.test(query)) {
        return (await repository.getFinalizedResults())
          .slice()
          .sort((left, right) =>
            String(right.confirmedAt ?? right.lastCheckedAt ?? '').localeCompare(String(left.confirmedAt ?? left.lastCheckedAt ?? '')) ||
            right.matchId - left.matchId
          )
          .slice(0, 8)
          .map((result) => ({ id: result.matchId }));
      }
      return [];
    },
    async run() {
      return undefined;
    },
    async exec() {
      return undefined;
    },
    async transaction(callback: (tx: { run: typeof this.run }) => Promise<void>) {
      await callback({ run: this.run });
    }
  };
}
