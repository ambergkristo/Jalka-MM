import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { createDatabase, type QueryableDatabase } from '../server/databaseAdapter.js';
import { DatabaseResultRepository } from '../server/results/databaseResultRepository.js';
import { confirmManualResult } from '../server/results/manualResultCorrection.js';
import { choosePublicStateRepairAction, queuePublicStateRepairIfStale, collectPublicStateDiagnostics, runPublicStateRepairAction, touchPublicDashboardRead } from '../server/results/publicStateHealth.js';
import { getPublicTournamentSnapshot } from '../server/results/publicTournamentSnapshot.js';
import { resetSimulationState } from '../server/results/matchdaySimulation.js';
import type { ResultAgentStatus } from '../server/results/resultTypes.js';

const MOCK_RESULT_AGENT_STATUS: ResultAgentStatus = {
  staleMatchesCount: 0,
  provider: 'mock-result-provider',
  mode: 'mock',
  providerChain: ['mock-result-provider'],
  providerReachable: true,
  pendingWarningsCount: 0,
  latestConfirmedResultCount: 0
};

describe('public state health', () => {
  it('collects diagnostics counts, timestamps, and no secrets', async () => {
    await withSimulationDb(async (db) => {
      const now = new Date('2026-06-13T07:10:20.000Z');
      await touchPublicDashboardRead({ db, now });
      await seedConfirmedResult(db);

      const diagnostics = await collectPublicStateDiagnostics({ db, now, resultAgentStatus: MOCK_RESULT_AGENT_STATUS });

      assert.equal(diagnostics.generatedAt, now.toISOString());
      assert.equal(diagnostics.serverTime, now.toISOString());
      assert.equal(diagnostics.confirmedResultsCount, 1);
      assert.equal(diagnostics.liveMatchesCount >= 0, true);
      assert.equal(diagnostics.latestResultsCount, 1);
      assert.equal(diagnostics.groupStandingsRowsCount > 0, true);
      assert.equal(diagnostics.leaderboardRowsCount, 109);
      assert.equal(diagnostics.canonicalLeaderboardRowsCount, 109);
      assert.equal(diagnostics.topScorerRowsCount, 1);
      assert.equal(diagnostics.lastPublicDashboardReadAt, now.toISOString());
      assert.equal(hasSecretKey(diagnostics), false);
      assert.equal(hasSecretKey(diagnostics.resultAgentStatus), false);
    });
  });

  it('detects provider scorer data and selects scorer resync when confirmed goals exist without scorer facts', async () => {
    await withSimulationDb(async (db) => {
      await seedProviderConfirmedResult(db);

      const before = await collectPublicStateDiagnostics({ db, resultAgentStatus: MOCK_RESULT_AGENT_STATUS });
      assert.equal(before.providerScorerDataDetected, 'yes');
      assert.equal(before.confirmedGoalsCount, 2);
      assert.equal(before.scorerFactsCount, 0);
      assert.equal(before.topScorerRowsCount, 0);
      assert.equal(before.staleState, true);
      assert.equal(before.staleReasons.some((reason) => reason.includes('no scorer facts are available')), true);
      assert.equal(choosePublicStateRepairAction(before), 'resync-scorers-from-confirmed-results');
    });
  });

  it('warns when scorer facts exceed confirmed goals', async () => {
    await withSimulationDb(async (db) => {
      const repository = new DatabaseResultRepository(db);
      await confirmManualResult({
        db,
        repository,
        leaderboardRepository: repository,
        confirmation: {
          matchId: 1,
          homeScore: 2,
          awayScore: 0,
          source: 'manual',
          confirmedBy: 'test-operator',
          scorers: [
            { playerName: 'Santiago Gimenez', teamCode: 'MEX', goals: 3 }
          ],
          now: new Date('2026-06-13T07:05:00.000Z')
        }
      });

      const diagnostics = await collectPublicStateDiagnostics({ db, resultAgentStatus: MOCK_RESULT_AGENT_STATUS });
      assert.equal(diagnostics.confirmedGoalsCount, 2);
      assert.equal(diagnostics.scorerFactsGoalsCount, 3);
      assert.equal(diagnostics.staleReasons.some((reason) => reason.includes('Scorer facts exceed confirmed match goal total')), true);
      assert.equal(diagnostics.staleState, true);
    });
  });

  it('does not keep operator status failed when current diagnostics are healthy', async () => {
    await withSimulationDb(async (db) => {
      await seedConfirmedResult(db);
      await db.run(
        `INSERT INTO public_state_metadata (
          id, last_repair_action, last_repair_action_at, last_repair_action_status, last_repair_action_error
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          last_repair_action = excluded.last_repair_action,
          last_repair_action_at = excluded.last_repair_action_at,
          last_repair_action_status = excluded.last_repair_action_status,
          last_repair_action_error = excluded.last_repair_action_error`,
        ['current', 'rebuild-public-dashboard', '2026-06-13T07:01:00.000Z', 'failed', 'old failure']
      );

      const diagnostics = await collectPublicStateDiagnostics({ db, resultAgentStatus: MOCK_RESULT_AGENT_STATUS });

      assert.equal(diagnostics.staleState, false);
      assert.equal(diagnostics.resultAgentStatus.providerReachable, true);
      assert.equal(diagnostics.operatorStatus, 'OK');
    });
  });

  it('re-syncs scorers from confirmed provider results and populates public standings', async () => {
    await withSimulationDb(async (db) => {
      await seedProviderConfirmedResult(db);
      await db.run('DELETE FROM result_manual_scorers');
      await db.run('DELETE FROM top_scorer_standings');

      const repair = await runPublicStateRepairAction({ action: 'resync-scorers-from-confirmed-results', db, now: new Date('2026-06-13T07:35:00.000Z') });
      assert.equal(repair.status, 'ok');
      assert.equal(await countRows(db, 'result_manual_scorers') > 0, true);
      assert.equal(await countRows(db, 'top_scorer_standings') > 0, true);
      const snapshot = await getPublicTournamentSnapshot(db);
      assert.equal(snapshot.topScorers.length > 0, true);
    });
  });

  it('auto-backfills top scorers from confirmed provider results on public read', async () => {
    await withSimulationDb(async (db) => {
      await seedProviderConfirmedResult(db);
      await db.run('DELETE FROM result_manual_scorers');
      await db.run('DELETE FROM top_scorer_standings');

      const snapshot = await getPublicTournamentSnapshot(db);
      assert.equal(snapshot.topScorers.length > 0, true);
      assert.equal(await countRows(db, 'result_manual_scorers') > 0, true);
      assert.equal(await countRows(db, 'top_scorer_standings') > 0, true);
    });
  });

  it('rebuilds group standings idempotently without deleting confirmed results', async () => {
    await withSimulationDb(async (db) => {
      await seedConfirmedResult(db);
      const before = await countRows(db, 'group_standings');

      await runPublicStateRepairAction({ action: 'rebuild-group-standings', db, now: new Date('2026-06-13T07:15:00.000Z') });
      await runPublicStateRepairAction({ action: 'rebuild-group-standings', db, now: new Date('2026-06-13T07:16:00.000Z') });

      assert.equal(await countRows(db, 'match_results'), 1);
      assert.equal(await countRows(db, 'group_standings'), before);
    });
  });

  it('rebuilds leaderboard idempotently without deleting confirmed results', async () => {
    await withSimulationDb(async (db) => {
      await seedConfirmedResult(db);
      await db.run('DELETE FROM leaderboard_entries');

      await runPublicStateRepairAction({ action: 'rebuild-leaderboard', db, now: new Date('2026-06-13T07:20:00.000Z') });
      const firstCount = await countRows(db, 'leaderboard_entries');
      await runPublicStateRepairAction({ action: 'rebuild-leaderboard', db, now: new Date('2026-06-13T07:21:00.000Z') });

      assert.equal(await countRows(db, 'match_results'), 1);
      assert.equal(await countRows(db, 'leaderboard_entries'), firstCount);
      assert.equal(firstCount, 109);
    });
  });

  it('rebuilds top scorer standings idempotently without inventing scorers', async () => {
    await withSimulationDb(async (db) => {
      await seedConfirmedResult(db);
      await db.run('DELETE FROM top_scorer_standings');

      await runPublicStateRepairAction({ action: 'rebuild-top-scorers', db, now: new Date('2026-06-13T07:25:00.000Z') });
      const firstTopScorer = await db.one('SELECT player_name, goals FROM top_scorer_standings ORDER BY rank LIMIT 1');
      await runPublicStateRepairAction({ action: 'rebuild-top-scorers', db, now: new Date('2026-06-13T07:26:00.000Z') });

      assert.equal(await countRows(db, 'match_results'), 1);
      assert.equal(await countRows(db, 'top_scorer_standings'), 1);
      assert.equal(String(firstTopScorer?.player_name), 'Santiago Gimenez');
      assert.equal(Number(firstTopScorer?.goals), 2);
    });
  });

  it('queues a safe repair when stale public state is detected', async () => {
    await withSimulationDb(async (db) => {
      await seedConfirmedResult(db);
      await db.run('DELETE FROM leaderboard_entries');
      await db.run('DELETE FROM group_standings');
      await db.run('DELETE FROM top_scorer_standings');

      const before = await collectPublicStateDiagnostics({ db, resultAgentStatus: MOCK_RESULT_AGENT_STATUS });
      assert.equal(before.staleState, true);

      const repair = await queuePublicStateRepairIfStale({ db, now: new Date('2026-06-13T07:30:00.000Z'), resultAgentStatus: MOCK_RESULT_AGENT_STATUS });
      assert.equal(repair?.status, 'ok');
      assert.equal(await countRows(db, 'match_results'), 1);
      assert.equal(await countRows(db, 'leaderboard_entries'), 109);
      assert.equal(await countRows(db, 'group_standings') > 0, true);
      assert.equal(await countRows(db, 'top_scorer_standings'), 1);

      const snapshot = await getPublicTournamentSnapshot(db);
      assert.equal(snapshot.latestResults.length, 1);
      assert.equal(snapshot.leaderboard.length, 109);
      assert.equal(snapshot.topScorers.length, 1);
    });
  });
});

async function withSimulationDb(callback: (db: QueryableDatabase) => Promise<void>): Promise<void> {
  const db = createDatabase({
    appEnv: 'local',
    databaseMode: 'sqlite',
    sqlitePath: join(tmpdir(), `jalka-mm-public-state-health-${randomUUID()}.sqlite`),
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

async function seedConfirmedResult(db: QueryableDatabase): Promise<void> {
  const repository = new DatabaseResultRepository(db);
  await confirmManualResult({
    db,
    repository,
    leaderboardRepository: repository,
    confirmation: {
      matchId: 1,
      homeScore: 2,
      awayScore: 0,
      source: 'manual',
      confirmedBy: 'test-operator',
      scorers: [{ playerName: 'Santiago Gimenez', teamCode: 'MEX', goals: 2 }],
      now: new Date('2026-06-13T07:00:00.000Z')
    }
  });
}

async function seedProviderConfirmedResult(db: QueryableDatabase): Promise<void> {
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

function countRows(db: QueryableDatabase, table: string): Promise<number> {
  return db.one(`SELECT COUNT(*) AS count FROM ${table}`).then((row) => Number((row as { count?: number } | undefined)?.count ?? 0));
}

function hasSecretKey(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(value as Record<string, unknown>).some((key) => /secret/i.test(key) || hasSecretKey((value as Record<string, unknown>)[key]));
}
