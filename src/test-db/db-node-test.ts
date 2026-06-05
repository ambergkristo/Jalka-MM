import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { join } from 'node:path';

process.env.WORLDCUP_DB_PATH = join(process.cwd(), 'data', 'test-worldcup2026-public.sqlite');

const { db, getPublicState, getTournamentSummary, healthCheck, recordResultUpdate, resetDevData, seedTournamentData } = await import('../server/db.js');

describe('public tracker database', () => {
  beforeEach(async () => {
    await resetDevData({ allowDestructive: true, confirmation: 'DELETE_LOCAL_DATA' });
  });

  it('seeds tournament structure without auth or submission tables', async () => {
    await seedTournamentData();
    const summary = await getTournamentSummary();
    assert.deepEqual(summary, { teams: 48, groups: 12, matches: 104 });

    const authTables = await db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('users', 'sessions', 'admin_accounts', 'prediction_submissions')");
    assert.equal(authTables.length, 0);
  });

  it('returns public read-only state and health metadata', async () => {
    await seedTournamentData();
    const state = await getPublicState();
    assert.equal(state.status, 'ok');
    assert.equal(state.routes.includes('/leaderboard'), true);

    const health = await healthCheck();
    assert.equal(health.publicReadOnly, true);
    assert.equal(health.authEnabled, false);
    assert.equal(health.databaseConnectivity, true);
  });

  it('stores result update metadata for future agent workflow', async () => {
    await seedTournamentData();
    const id = await recordResultUpdate({ matchId: 1, source: 'test-agent', status: 'SCHEDULED', nextCheckAt: '2026-06-11T18:30:00.000Z' });
    const row = await db.one('SELECT * FROM result_updates WHERE id = ?', [id]);
    assert.equal(row?.source, 'test-agent');
    assert.equal(row?.status, 'SCHEDULED');
    assert.equal(row?.is_final, 0);
  });
});
