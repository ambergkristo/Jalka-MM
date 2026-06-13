import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { createDatabase, type QueryableDatabase } from '../server/databaseAdapter.js';
import { DatabaseResultRepository } from '../server/results/databaseResultRepository.js';
import { rebuildPublicTournamentState } from '../server/results/publicTournamentRebuild.js';
import { resetSimulationState } from '../server/results/matchdaySimulation.js';
import { runResultUpdateCycle } from '../server/results/resultAgent.js';
import { toResultUpdate, type ResultProvider } from '../server/results/resultProvider.js';

describe('automatic public state sync', () => {
  it('automatically rebuilds scorer standings after a confirmed final result', async () => {
    await withSimulationDb(async (db) => {
      const repository = new DatabaseResultRepository(db);
      await db.exec('DELETE FROM matches WHERE id <> 1');
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
            providerMatchId: String(match.id),
            scorers: [
              { playerName: 'J. Quiñones', teamName: 'Mexico', goals: 1 },
              { playerName: 'R. Jiménez', teamName: 'Mexico', goals: 1 }
            ]
          });
        }
      };

      const now = new Date('2026-06-13T07:00:00.000Z');
      const first = await runResultUpdateCycle({ repository, leaderboardRepository: repository, provider, now, confirmationDelayMinutes: 10 });
      const second = await runResultUpdateCycle({ repository, leaderboardRepository: repository, provider, now: new Date('2026-06-13T07:11:00.000Z'), confirmationDelayMinutes: 10 });

      assert.equal(first.finalizedResults, 0);
      assert.equal(second.finalizedResults, 1);
      assert.equal(await countRows(db, 'result_manual_scorers'), 2);
      assert.equal((await countRows(db, 'top_scorer_standings')) >= 2, true);
      assert.equal(await countRows(db, 'leaderboard_entries'), 109);
      const metadata = await db.one('SELECT last_public_snapshot_rebuild_at FROM public_state_metadata WHERE id = ?', ['public-state']);
      assert.equal(Boolean(metadata?.last_public_snapshot_rebuild_at), true);
    });
  });

  it('repairs missing scorer standings on startup and stays idempotent', async () => {
    await withSimulationDb(async (db) => {
      await seedConfirmedProviderResult(db);
      await db.run('DELETE FROM result_manual_scorers');
      await db.run('DELETE FROM top_scorer_standings');

      const first = await rebuildPublicTournamentState(db, new Date('2026-06-13T07:20:00.000Z'));
      const firstScorerFacts = await countRows(db, 'result_manual_scorers');
      const firstTopScorers = await countRows(db, 'top_scorer_standings');

      const second = await rebuildPublicTournamentState(db, new Date('2026-06-13T07:21:00.000Z'));

      assert.equal(firstScorerFacts > 0, true);
      assert.equal(firstTopScorers > 0, true);
      assert.equal(await countRows(db, 'result_manual_scorers'), firstScorerFacts);
      assert.equal(await countRows(db, 'top_scorer_standings'), firstTopScorers);
      assert.equal(first.leaderboardRowsCount, 109);
      assert.equal(second.leaderboardRowsCount, 109);
    });
  });
});

async function withSimulationDb(callback: (db: QueryableDatabase) => Promise<void>): Promise<void> {
  const db = createDatabase({
    appEnv: 'local',
    databaseMode: 'sqlite',
    sqlitePath: join(tmpdir(), `jalka-mm-auto-public-state-${randomUUID()}.sqlite`),
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

async function seedConfirmedProviderResult(db: QueryableDatabase): Promise<void> {
  const repository = new DatabaseResultRepository(db);
  await repository.saveResultUpdate({
    matchId: 1,
    providerMatchId: '1',
    status: 'FINISHED',
    publicStatus: 'CONFIRMED_FINAL',
    homeScore: 2,
    awayScore: 0,
    confirmedHomeScore: 2,
    confirmedAwayScore: 0,
    confirmedAt: '2026-06-13T07:00:00.000Z',
    confirmationSource: 'provider',
    confirmationConfidence: 'provider-repeat',
    minute: 90,
    isFinal: true,
    lastCheckedAt: '2026-06-13T07:00:00.000Z',
    provider: 'open-worldcup-result-provider',
    rawProviderStatus: 'FINISHED',
    providerResults: [{
      provider: 'open-worldcup-result-provider',
      matchId: 1,
      providerFixtureId: '1',
      status: 'FINISHED',
      homeScore: 2,
      awayScore: 0,
      isFinal: true,
      observedAt: '2026-06-13T07:00:00.000Z',
      rawProviderStatus: 'TRUE',
      scorers: [
        { playerName: 'J. Quiñones', teamName: 'Mexico', goals: 1 },
        { playerName: 'R. Jiménez', teamName: 'Mexico', goals: 1 }
      ]
    }]
  });
}

async function countRows(db: QueryableDatabase, table: string): Promise<number> {
  return Number((await db.one(`SELECT COUNT(*) AS count FROM ${table}`))?.count ?? 0);
}
