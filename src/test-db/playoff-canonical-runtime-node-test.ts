import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { createDatabase, type QueryableDatabase } from '../server/databaseAdapter.js';
import { DatabaseResultRepository } from '../server/results/databaseResultRepository.js';
import { resetSimulationState } from '../server/results/matchdaySimulation.js';
import { collectProviderHealth } from '../server/results/providerHealth.js';
import { getPublicTournamentSnapshot } from '../server/results/publicTournamentSnapshot.js';
import { buildActualKnockoutResults } from '../server/results/scoringState.js';
import type { ResultAgentStatus } from '../server/results/resultTypes.js';

const RESULT_AGENT_STATUS: ResultAgentStatus = {
  lastRunAt: '2026-06-29T19:14:00.000Z',
  nextSuggestedRunAt: '2026-06-29T19:15:00.000Z',
  staleMatchesCount: 0,
  provider: 'open-worldcup-result-provider',
  mode: 'live',
  providerChain: ['open-worldcup'],
  writeMode: 'live',
  providerReachable: true,
  pendingWarningsCount: 0,
  latestConfirmedResultCount: 72
};

describe('canonical playoff runtime', () => {
  it('uses the same canonical playoff source for tracked matches, provider health, public snapshot, and knockout progression', async () => {
    await withSimulationDb(async (db) => {
      const repository = new DatabaseResultRepository(db);
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => ({
        ok: true,
        status: 200,
        async text() {
          return '';
        },
        async json() {
          return {
            response: [
              {
                id: 73,
                type: 'R32',
                status: 'FINISHED',
                local_date: '2026-06-28T19:00:00.000Z',
                home_team_name_en: 'South Africa',
                away_team_name_en: 'Canada',
                home_team_label: 'South Africa',
                away_team_label: 'Canada',
                home_score: 0,
                away_score: 1
              },
              {
                id: 74,
                type: 'R32',
                status: 'SCHEDULED',
                local_date: '2026-06-29T20:30:00.000Z',
                home_team_name_en: 'Germany',
                away_team_name_en: 'Paraguay',
                home_team_label: 'Germany',
                away_team_label: 'Paraguay',
                home_score: 0,
                away_score: 0
              }
            ]
          };
        }
      })) as unknown as typeof fetch;
      try {
        await seedConfirmedGroupStage(repository);

        const trackedMatches = await repository.listTrackedMatches();
        const playoffMatches = trackedMatches.filter((match) => match.id >= 73);
        const match73 = trackedMatches.find((match) => match.id === 73);

        assert.equal(playoffMatches.length, 32);
        assert.equal(match73?.providerMatchId, '73');
        assert.equal(match73?.kickoffUtc, '2026-06-28T19:00:00.000Z');
        assert.equal(match73?.homeTeam, 'Lõuna-Aafrika');
        assert.equal(match73?.awayTeam, 'Kanada');
        assert.equal(trackedMatches.some((match) => match.id === 99), true);
        assert.equal(trackedMatches.some((match) => match.id === 104), true);

        await repository.saveResultUpdate({
          matchId: 73,
          providerMatchId: '73',
          status: 'FINISHED',
          publicStatus: 'CONFIRMED_FINAL',
          homeScore: 0,
          awayScore: 1,
          confirmedHomeScore: 0,
          confirmedAwayScore: 1,
          confirmedAt: '2026-06-29T19:14:00.000Z',
          confirmationSource: 'provider',
          confirmationConfidence: 'provider-repeat',
          isFinal: true,
          lastCheckedAt: '2026-06-29T19:14:00.000Z',
          provider: 'open-worldcup-result-provider',
          rawProviderStatus: 'FINISHED',
          providerResults: []
        });

        const health = await collectProviderHealth({
          db,
          now: new Date('2026-06-29T19:20:00.000Z'),
          resultAgentStatus: {
            ...RESULT_AGENT_STATUS,
            latestConfirmedResultCount: 73
          },
          providerMatchMap: []
        });
        assert.equal(health.matchHealth.totalMatches, 104);
        assert.equal(health.matchHealth.confirmedMatches, 73);
        assert.equal(health.matchHealth.upcomingMatches > 0, true);

        const snapshot = await getPublicTournamentSnapshot(db, new Date('2026-06-29T19:20:00.000Z'));
        const latest73 = snapshot.latestResults.find((result) => result.id === '73');
        assert.equal(snapshot.completedMatchesCount, 73);
        assert.equal(snapshot.upcomingMatches.some((match) => match.id === '74'), true);
        assert.deepEqual(latest73, {
          id: '73',
          homeTeam: 'Lõuna-Aafrika',
          awayTeam: 'Kanada',
          homeScore: 0,
          awayScore: 1,
          stage: 'R32',
          winner: 'Kanada',
          finishedAt: '29.06 22:14'
        });

        const knockoutResults = await buildActualKnockoutResults(db);
        assert.equal(knockoutResults.stageTeams?.R16?.includes('Kanada'), true);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});

async function withSimulationDb(callback: (db: QueryableDatabase) => Promise<void>): Promise<void> {
  const db = createDatabase({
    appEnv: 'local',
    databaseMode: 'sqlite',
    sqlitePath: join(tmpdir(), `jalka-mm-playoff-canonical-${randomUUID()}.sqlite`),
    publicAppBaseUrl: 'http://localhost:5174',
    tournamentDataMode: 'partial_official',
    allowDestructiveCommands: true,
    allowUnsafeProductionSqlite: false
  });
  try {
    await resetSimulationState(db, { seedSchedule: true });
    await callback(db);
  } finally {
    await db.close();
  }
}

async function seedConfirmedGroupStage(repository: DatabaseResultRepository): Promise<void> {
  for (let matchId = 1; matchId <= 72; matchId += 1) {
    await repository.saveResultUpdate({
      matchId,
      providerMatchId: String(matchId),
      status: 'FINISHED',
      publicStatus: 'CONFIRMED_FINAL',
      homeScore: 0,
      awayScore: 0,
      confirmedHomeScore: 0,
      confirmedAwayScore: 0,
      confirmedAt: '2026-06-28T00:00:00.000Z',
      confirmationSource: 'seed',
      confirmationConfidence: 'provider-repeat',
      isFinal: true,
      lastCheckedAt: '2026-06-28T00:00:00.000Z',
      provider: 'seed-provider',
      rawProviderStatus: 'FINISHED',
      providerResults: []
    });
  }
}
