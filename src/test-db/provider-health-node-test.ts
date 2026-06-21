import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { createDatabase, type QueryableDatabase } from '../server/databaseAdapter.js';
import { collectProviderHealth } from '../server/results/providerHealth.js';
import { migrateResultPersistenceSchema } from '../server/results/resultPersistenceSchema.js';
import type { ResultAgentStatus } from '../server/results/resultTypes.js';

const RESULT_AGENT_STATUS: ResultAgentStatus = {
  lastRunAt: '2026-06-21T19:00:00.000Z',
  nextSuggestedRunAt: '2026-06-21T19:01:00.000Z',
  staleMatchesCount: 0,
  provider: 'free-worldcup-provider-chain:open-worldcup-result-provider',
  mode: 'live',
  providerChain: ['free-worldcup', 'open-worldcup'],
  writeMode: 'live',
  providerReachable: true,
  pendingWarningsCount: 0,
  latestConfirmedResultCount: 1
};

describe('provider health', () => {
  it('calculates provider health metrics and response shape from persisted results', async () => {
    await withHealthDb(async (db) => {
      const envSnapshot = snapshotProviderEnv();
      try {
        process.env.RESULTS_PROVIDER = 'mock';
        process.env.RESULTS_PROVIDER_CHAIN = 'mock';
        delete process.env.FOOTBALL_DATA_API_KEY;
        delete process.env.FOOTBALL_DATA_API_BASE_URL;
        await seedProviderHealthState(db);

        const now = new Date('2026-06-21T20:10:00.000Z');
        const health = await collectProviderHealth({
          db,
          now,
          processStartedAt: new Date('2026-06-21T20:05:00.000Z'),
          resultAgentStatus: RESULT_AGENT_STATUS,
          providerMatchMap: []
        });

        assert.deepEqual(Object.keys(health).sort(), [
          'delayedConfirmationWarnings',
          'generatedAt',
          'manualOverrideSafety',
          'matchHealth',
          'providerStatus',
          'providerVerifierStatus',
          'scorerHealth',
          'status'
        ].sort());
        assert.equal(health.status, 'ProviderCritical');
        assert.equal(health.providerStatus.activeProviderName, 'free-worldcup-provider-chain:open-worldcup-result-provider');
        assert.equal(health.providerStatus.lastSuccessfulPollAt, '2026-06-21T19:00:00.000Z');
        assert.equal(health.providerStatus.lastFailedPollAt, '2026-06-21T19:05:00.000Z');
        assert.equal(health.providerStatus.pollingIntervalSeconds, 60);
        assert.equal(health.providerStatus.processUptimeSeconds, 300);
        assert.deepEqual(health.matchHealth, {
          totalMatches: 4,
          confirmedMatches: 1,
          liveOrProvisionalMatches: 2,
          upcomingMatches: 1,
          awaitingConfirmationMatches: 1
        });
        assert.equal(health.delayedConfirmationWarnings.length, 2);
        assert.equal(health.delayedConfirmationWarnings[0]?.severity, 'critical');
        assert.equal(health.delayedConfirmationWarnings[1]?.severity, 'delayed');
        assert.equal(health.scorerHealth.confirmedGoalsCount, 2);
        assert.equal(health.scorerHealth.scorerFactsGoalsCount, 1);
        assert.equal(health.scorerHealth.missingGoalsCount, 1);
        assert.equal(health.scorerHealth.hasMismatch, true);
        assert.equal(health.manualOverrideSafety.manualCorrectedMatchesCount, 1);
        assert.equal(health.manualOverrideSafety.confirmedManualResultsCount, 1);
        assert.equal(health.manualOverrideSafety.staleProviderOverwriteAttemptsAvailable, false);
        assert.equal(health.manualOverrideSafety.manualOverrideProtectionActive, true);
        assert.deepEqual(health.providerVerifierStatus, {
          enabled: false,
          status: 'Verifier inactive',
          providerDisagreementsDetected: 0,
          unresolvedDisagreementsCount: 0
        });
      } finally {
        restoreProviderEnv(envSnapshot);
      }
    });
  });
});

async function withHealthDb(callback: (db: QueryableDatabase) => Promise<void>): Promise<void> {
  const db = createDatabase({
    appEnv: 'local',
    databaseMode: 'sqlite',
    sqlitePath: join(tmpdir(), `jalka-mm-provider-health-${randomUUID()}.sqlite`),
    publicAppBaseUrl: 'http://localhost:5174',
    tournamentDataMode: 'partial_official',
    allowDestructiveCommands: true,
    allowUnsafeProductionSqlite: false
  });
  try {
    await createSeedTables(db);
    await migrateResultPersistenceSchema(db);
    await callback(db);
  } finally {
    await db.close();
  }
}

async function createSeedTables(db: QueryableDatabase): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_et TEXT,
      code TEXT,
      flag TEXT,
      group_id TEXT
    );
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY,
      stage TEXT NOT NULL,
      group_id TEXT,
      kickoff_at TEXT NOT NULL,
      home_team_id TEXT,
      away_team_id TEXT,
      home_slot TEXT NOT NULL,
      away_slot TEXT NOT NULL
    );
  `);
}

async function seedProviderHealthState(db: QueryableDatabase): Promise<void> {
  await db.run(`INSERT INTO teams (id, name, name_et, code, flag, group_id) VALUES (?, ?, ?, ?, ?, ?)`, ['spa', 'Spain', 'Hispaania', 'ESP', '', 'A']);
  await db.run(`INSERT INTO teams (id, name, name_et, code, flag, group_id) VALUES (?, ?, ?, ?, ?, ?)`, ['ksa', 'Saudi Arabia', 'Saudi Araabia', 'KSA', '', 'A']);
  await db.run(`INSERT INTO teams (id, name, name_et, code, flag, group_id) VALUES (?, ?, ?, ?, ?, ?)`, ['bel', 'Belgium', 'Belgia', 'BEL', '', 'B']);
  await db.run(`INSERT INTO teams (id, name, name_et, code, flag, group_id) VALUES (?, ?, ?, ?, ?, ?)`, ['irn', 'Iran', 'Iraan', 'IRN', '', 'B']);
  await db.run(`INSERT INTO teams (id, name, name_et, code, flag, group_id) VALUES (?, ?, ?, ?, ?, ?)`, ['arg', 'Argentina', 'Argentina', 'ARG', '', 'C']);
  await db.run(`INSERT INTO teams (id, name, name_et, code, flag, group_id) VALUES (?, ?, ?, ?, ?, ?)`, ['fra', 'France', 'Prantsusmaa', 'FRA', '', 'C']);
  await db.run(`INSERT INTO teams (id, name, name_et, code, flag, group_id) VALUES (?, ?, ?, ?, ?, ?)`, ['usa', 'United States', 'USA', 'USA', '', 'D']);
  await db.run(`INSERT INTO teams (id, name, name_et, code, flag, group_id) VALUES (?, ?, ?, ?, ?, ?)`, ['can', 'Canada', 'Kanada', 'CAN', '', 'D']);

  await insertMatch(db, 1, '2026-06-21T17:00:00.000Z', 'spa', 'ksa', 'Spain', 'Saudi Arabia');
  await insertMatch(db, 2, '2026-06-21T18:00:00.000Z', 'bel', 'irn', 'Belgium', 'Iran');
  await insertMatch(db, 3, '2026-06-21T10:00:00.000Z', 'arg', 'fra', 'Argentina', 'France');
  await insertMatch(db, 4, '2026-06-22T10:00:00.000Z', 'usa', 'can', 'United States', 'Canada');

  await db.run(`
    INSERT INTO match_results (
      match_id, home_score, away_score, status, public_status, is_final,
      provider, raw_provider_status, last_checked_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [1, 1, 1, 'LIVE', 'LIVE', 0, 'open-worldcup-result-provider', 'LIVE', '2026-06-21T19:55:00.000Z', '2026-06-21T19:55:00.000Z']);
  await db.run(`
    INSERT INTO match_results (
      match_id, home_score, away_score, status, public_status, is_final,
      provider, raw_provider_status, last_checked_at, next_confirmation_check_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [2, 2, 0, 'FINISHED', 'CONFIRMING', 0, 'open-worldcup-result-provider', 'FINISHED', '2026-06-21T19:50:00.000Z', '2026-06-21T20:20:00.000Z', '2026-06-21T19:50:00.000Z']);
  await db.run(`
    INSERT INTO match_results (
      match_id, home_score, away_score, confirmed_home_score, confirmed_away_score,
      confirmed_at, confirmation_source, confirmation_confidence, status, public_status,
      is_final, provider, raw_provider_status, last_checked_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [3, 2, 0, 2, 0, '2026-06-21T12:00:00.000Z', 'manual-ui', 'manual', 'FINISHED', 'CONFIRMED_FINAL', 1, 'manual', 'FINISHED', '2026-06-21T12:00:00.000Z', '2026-06-21T12:00:00.000Z']);

  await db.run(`
    INSERT INTO result_manual_scorers (id, match_id, player_name, team_id, team_code, goals, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, ['scorer-1', 3, 'Lionel Messi', 'arg', 'ARG', 1, '2026-06-21T12:01:00.000Z']);
  await db.run(`
    INSERT INTO result_manual_corrections (
      id, match_id, previous_home_score, previous_away_score, new_home_score, new_away_score,
      previous_status, new_status, source, confirmed_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, ['manual-1', 3, null, null, 2, 0, 'SCHEDULED', 'CONFIRMED_FINAL', 'manual-ui', 'operator', '2026-06-21T12:00:00.000Z']);
  await db.run(`
    INSERT INTO result_agent_runs (
      id, started_at, finished_at, checked_matches, updated_matches, finalized_matches,
      leaderboard_rebuilt, players_processed, warnings_json, warning_details_json, provider, mode
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, ['run-success', '2026-06-21T18:59:00.000Z', '2026-06-21T19:00:00.000Z', 4, 2, 1, 0, 0, '[]', '[]', 'open-worldcup-result-provider', 'live']);
  await db.run(`
    INSERT INTO result_agent_runs (
      id, started_at, finished_at, checked_matches, updated_matches, finalized_matches,
      leaderboard_rebuilt, players_processed, warnings_json, warning_details_json, provider, mode
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, ['run-failed', '2026-06-21T19:04:00.000Z', '2026-06-21T19:05:00.000Z', 4, 0, 0, 0, 0, '["provider request failed"]', '[]', 'open-worldcup-result-provider', 'live']);
}

async function insertMatch(
  db: QueryableDatabase,
  id: number,
  kickoffAt: string,
  homeTeamId: string,
  awayTeamId: string,
  homeSlot: string,
  awaySlot: string
): Promise<void> {
  await db.run(
    `INSERT INTO matches (id, stage, group_id, kickoff_at, home_team_id, away_team_id, home_slot, away_slot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, 'GROUP', 'A', kickoffAt, homeTeamId, awayTeamId, homeSlot, awaySlot]
  );
}

function snapshotProviderEnv(): Record<string, string | undefined> {
  return {
    RESULTS_PROVIDER: process.env.RESULTS_PROVIDER,
    RESULTS_PROVIDER_CHAIN: process.env.RESULTS_PROVIDER_CHAIN,
    FOOTBALL_DATA_API_KEY: process.env.FOOTBALL_DATA_API_KEY,
    FOOTBALL_DATA_API_BASE_URL: process.env.FOOTBALL_DATA_API_BASE_URL
  };
}

function restoreProviderEnv(snapshot: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
