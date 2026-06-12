import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { describe, it } from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase } from '../server/databaseAdapter.js';
import { DatabaseResultRepository } from '../server/results/databaseResultRepository.js';
import { confirmManualResult } from '../server/results/manualResultCorrection.js';
import { migrateResultPersistenceSchema } from '../server/results/resultPersistenceSchema.js';
import { syncConfirmedScorersForMatch } from '../server/results/topScorerStandings.js';

describe('top scorer standings persistence', () => {
  it('aggregates scorer facts across confirmed matches', async () => {
    const { db, sqlitePath } = createTempDatabase();
    try {
      await seedMatchTables(db);
      await migrateResultPersistenceSchema(db);

      await syncConfirmedScorersForMatch(db, 1, [
        { playerName: 'Rui Costa', teamName: 'Mexico', goals: 1 },
        { playerName: 'Rui Costa', teamName: 'Mexico', goals: 1 },
        { playerName: 'Santiago Gimenez', teamName: 'Mexico', goals: 1 }
      ], '2026-06-12T07:10:20.007Z');

      await syncConfirmedScorersForMatch(db, 2, [
        { playerName: 'Rui Costa', teamName: 'Mexico', goals: 1 }
      ], '2026-06-12T07:12:20.007Z');

      const standings = await db.all('SELECT rank, player_name, goals FROM top_scorer_standings ORDER BY rank');
      assert.equal(standings.length, 2);
      assert.equal(Number(standings[0]?.rank), 1);
      assert.equal(String(standings[0]?.player_name), 'Rui Costa');
      assert.equal(Number(standings[0]?.goals), 3);
      assert.equal(Number(standings[1]?.rank), 2);
      assert.equal(String(standings[1]?.player_name), 'Santiago Gimenez');
      assert.equal(Number(standings[1]?.goals), 1);
    } finally {
      await db.close();
      rmSync(sqlitePath, { force: true });
    }
  });

  it('lets manual confirmed results populate the public top scorers table', async () => {
    const { db, sqlitePath } = createTempDatabase();
    try {
      await seedMatchTables(db);
      await migrateResultPersistenceSchema(db);

      const repository = new DatabaseResultRepository(db);
      await confirmManualResult({
        db,
        repository,
        leaderboardRepository: repository,
        confirmation: {
          matchId: 1,
          homeScore: 2,
          awayScore: 0,
          source: 'manual-ui',
          confirmedBy: 'operator-ui',
          scorers: [
            { playerName: 'Rui Costa', teamName: 'Mexico', goals: 2 }
          ]
        }
      });

      const standings = await db.all('SELECT rank, player_name, goals FROM top_scorer_standings ORDER BY rank');
      assert.equal(standings.length, 1);
      assert.equal(Number(standings[0]?.rank), 1);
      assert.equal(String(standings[0]?.player_name), 'Rui Costa');
      assert.equal(Number(standings[0]?.goals), 2);
    } finally {
      await db.close();
      rmSync(sqlitePath, { force: true });
    }
  });
});

function createTempDatabase() {
  const root = mkdtempSync(join(tmpdir(), 'jalka-mm-top-scorers-'));
  const sqlitePath = join(root, 'data.sqlite');
  const db = createDatabase({
    appEnv: 'local',
    databaseMode: 'sqlite',
    sqlitePath,
    publicAppBaseUrl: 'http://localhost',
    tournamentDataMode: 'seeded',
    allowDestructiveCommands: false,
    allowUnsafeProductionSqlite: false
  });
  return { db, sqlitePath };
}

async function seedMatchTables(db: ReturnType<typeof createTempDatabase>['db']) {
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
    DELETE FROM teams;
    DELETE FROM matches;
    INSERT INTO teams (id, name, name_et, code, flag, group_id) VALUES
      ('MEX', 'Mexico', 'Mexico', 'MEX', '', 'A'),
      ('RSA', 'South Africa', 'Lõuna-Aafrika', 'RSA', '', 'A');
    INSERT INTO matches (id, stage, group_id, kickoff_at, home_team_id, away_team_id, home_slot, away_slot) VALUES
      (1, 'group', 'A', '2026-06-12T07:00:00.000Z', 'MEX', 'RSA', 'Mexico', 'South Africa'),
      (2, 'group', 'A', '2026-06-12T10:00:00.000Z', 'MEX', 'RSA', 'Mexico', 'South Africa');
  `);
}
