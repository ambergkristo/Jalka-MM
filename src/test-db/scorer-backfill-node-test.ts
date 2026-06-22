import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { createDatabase } from '../server/databaseAdapter.js';
import { backfillTopScorersFromConfirmedResults } from '../server/results/topScorerStandings.js';
import { migrateResultPersistenceSchema } from '../server/results/resultPersistenceSchema.js';

describe('historical scorer backfill', () => {
  it('creates missing scorer facts from provider payloads and manual corrections', async () => {
    const { db, sqlitePath } = createTempDatabase();
    try {
      await seedBackfillState(db);
      await migrateResultPersistenceSchema(db);

      const result = await backfillTopScorersFromConfirmedResults(db, '2026-06-22T09:00:00.000Z', {
        provider: createMockProvider()
      });

      assert.equal(result.repaired, true);
      assert.equal(result.repairedMatches, 7);
      assert.equal(result.scorerFactsSkipped, 0);

      const facts = await db.one(`
        SELECT COUNT(*) AS count, COALESCE(SUM(goals), 0) AS goals
        FROM result_manual_scorers
      `);
      const matchFacts = await db.all(`
        SELECT match_id, COUNT(*) AS count, COALESCE(SUM(goals), 0) AS goals
        FROM result_manual_scorers
        GROUP BY match_id
        ORDER BY match_id
      `);
      const topScorers = await db.all('SELECT player_name, goals FROM top_scorer_standings ORDER BY goals DESC, player_name ASC');

      assert.equal(Number(facts?.count ?? 0), 19);
      assert.equal(Number(facts?.goals ?? 0), 19);
      assert.deepEqual(matchFacts.map((row) => [Number(row.match_id), Number(row.count), Number(row.goals)]), [
        [1, 2, 2],
        [2, 3, 3],
        [3, 2, 2],
        [9, 1, 1],
        [20, 4, 4],
        [25, 2, 2],
        [26, 5, 5]
      ]);
      assert.equal(topScorers.some((row) => String(row.player_name) === 'Marko Arnautović'), true);
      assert.equal(topScorers.some((row) => String(row.player_name) === 'Teboho Mokoena'), true);
      assert.equal(topScorers.some((row) => String(row.player_name) === 'Granit Xhaka'), true);
    } finally {
      await db.close();
      rmSync(sqlitePath, { force: true });
    }
  });

  it('is idempotent across repeated backfills', async () => {
    const { db, sqlitePath } = createTempDatabase();
    try {
      await seedBackfillState(db);
      await migrateResultPersistenceSchema(db);

      const provider = createMockProvider();
      const first = await backfillTopScorersFromConfirmedResults(db, '2026-06-22T09:00:00.000Z', { provider });
      const second = await backfillTopScorersFromConfirmedResults(db, '2026-06-22T09:01:00.000Z', { provider });

      const facts = await db.one(`
        SELECT COUNT(*) AS count, COALESCE(SUM(goals), 0) AS goals
        FROM result_manual_scorers
      `);

      assert.equal(first.repairedMatches, 7);
      assert.equal(second.repairedMatches, 7);
      assert.equal(Number(facts?.count ?? 0), 19);
      assert.equal(Number(facts?.goals ?? 0), 19);
    } finally {
      await db.close();
      rmSync(sqlitePath, { force: true });
    }
  });
});

function createTempDatabase() {
  const root = mkdtempSync(join(tmpdir(), 'jalka-mm-scorer-backfill-'));
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

async function seedBackfillState(db: ReturnType<typeof createTempDatabase>['db']) {
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
    CREATE TABLE IF NOT EXISTS match_results (
      match_id INTEGER PRIMARY KEY,
      home_score INTEGER,
      away_score INTEGER,
      minute INTEGER,
      status TEXT NOT NULL,
      public_status TEXT NOT NULL DEFAULT 'SCHEDULED',
      is_final INTEGER NOT NULL DEFAULT 0,
      provisional_home_score INTEGER,
      provisional_away_score INTEGER,
      provisional_status TEXT,
      confirmed_home_score INTEGER,
      confirmed_away_score INTEGER,
      confirmed_at TEXT,
      confirmation_source TEXT,
      confirmation_confidence TEXT,
      needs_review_reason TEXT,
      provider TEXT,
      provider_fixture_id TEXT,
      raw_provider_status TEXT,
      last_checked_at TEXT,
      last_provider_check_at TEXT,
      next_check_at TEXT,
      next_confirmation_check_at TEXT,
      provider_results_json TEXT,
      updated_at TEXT NOT NULL,
      points_recalculated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS result_manual_scorers (
      id TEXT PRIMARY KEY,
      match_id INTEGER NOT NULL,
      player_id TEXT,
      provider_player_id TEXT,
      raw_player_name TEXT,
      player_name TEXT NOT NULL,
      team_id TEXT,
      team_code TEXT,
      goals INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS top_scorer_standings (
      id TEXT PRIMARY KEY,
      rank INTEGER NOT NULL,
      player_id TEXT,
      provider_player_id TEXT,
      player_name TEXT NOT NULL,
      team_id TEXT,
      goals INTEGER NOT NULL,
      assists INTEGER,
      minutes_played INTEGER,
      updated_at TEXT NOT NULL
    );
    DELETE FROM teams;
    DELETE FROM matches;
    DELETE FROM match_results;
    DELETE FROM result_manual_scorers;
    DELETE FROM top_scorer_standings;
  `);

  await insertTeam(db, 'A1', 'Mexico', 'MEX');
  await insertTeam(db, 'A2', 'South Africa', 'RSA');
  await insertTeam(db, 'A3', 'Korea Republic', 'KOR');
  await insertTeam(db, 'A4', 'Czechia', 'CZE');
  await insertTeam(db, 'B1', 'Canada', 'CAN');
  await insertTeam(db, 'B2', 'Bosnia and Herzegovina', 'BIH');
  await insertTeam(db, 'E3', "Côte d’Ivoire", 'CIV');
  await insertTeam(db, 'E4', 'Ecuador', 'ECU');
  await insertTeam(db, 'J3', 'Austria', 'AUT');
  await insertTeam(db, 'J4', 'Jordan', 'JOR');
  await insertTeam(db, 'B4', 'Switzerland', 'SUI');

  await insertMatch(db, 1, '2026-06-11T13:00:00.000Z', 'A1', 'A2', 'Mexico', 'South Africa');
  await insertMatch(db, 2, '2026-06-11T20:00:00.000Z', 'A3', 'A4', 'Korea Republic', 'Czechia');
  await insertMatch(db, 3, '2026-06-12T15:00:00.000Z', 'B1', 'B2', 'Canada', 'Bosnia and Herzegovina');
  await insertMatch(db, 9, '2026-06-14T19:00:00.000Z', 'E3', 'E4', "Côte d’Ivoire", 'Ecuador');
  await insertMatch(db, 20, '2026-06-16T21:00:00.000Z', 'J3', 'J4', 'Austria', 'Jordan');
  await insertMatch(db, 25, '2026-06-18T19:00:00.000Z', 'A4', 'A2', 'Czechia', 'South Africa');
  await insertMatch(db, 26, '2026-06-18T12:00:00.000Z', 'B4', 'B2', 'Switzerland', 'Bosnia and Herzegovina');

  await insertConfirmedResult(db, 1, 2, 0);
  await insertConfirmedResult(db, 2, 2, 1);
  await insertConfirmedResult(db, 3, 1, 1);
  await insertConfirmedResult(db, 9, 1, 0);
  await insertConfirmedResult(db, 20, 3, 1);
  await insertConfirmedResult(db, 25, 1, 1);
  await insertConfirmedResult(db, 26, 4, 1);
}

function createMockProvider() {
  return {
    name: 'mock-provider',
    mode: 'live' as const,
    async fetchMatchUpdate(match: { id: number; kickoffUtc: string; homeTeam: string; awayTeam: string }, now: Date) {
      const scorers = providerScorersByMatchId.get(match.id) ?? [];
      return {
        matchId: match.id,
        status: 'FINISHED',
        homeScore: undefined,
        awayScore: undefined,
        isFinal: true,
        lastCheckedAt: now.toISOString(),
        provider: 'mock-provider',
        rawProviderStatus: 'FINISHED',
        scorers
      } as never;
    }
  };
}

const providerScorersByMatchId = new Map<number, Array<{
  playerName: string;
  teamName: string;
  teamCode: string;
  goals: number;
}>>([
  [1, [
    { playerName: 'J. Quiñones', teamName: 'Mexico', teamCode: 'MEX', goals: 1 },
    { playerName: 'R. Jiménez', teamName: 'Mexico', teamCode: 'MEX', goals: 1 }
  ]],
  [2, [
    { playerName: 'Hwang Inbeom', teamName: 'Korea Republic', teamCode: 'KOR', goals: 1 },
    { playerName: 'Oh Hyeongyu', teamName: 'Korea Republic', teamCode: 'KOR', goals: 1 },
    { playerName: 'L. Krejčí', teamName: 'Czechia', teamCode: 'CZE', goals: 1 }
  ]],
  [3, [
    { playerName: 'Cyle Larin', teamName: 'Canada', teamCode: 'CAN', goals: 1 },
    { playerName: 'Jovo Lukić', teamName: 'Bosnia and Herzegovina', teamCode: 'BIH', goals: 1 }
  ]],
  [9, [
    { playerName: 'Amad Diallo', teamName: "Côte d’Ivoire", teamCode: 'CIV', goals: 1 }
  ]],
  [20, [
    { playerName: 'Romano Schmid', teamName: 'Austria', teamCode: 'AUT', goals: 1 },
    { playerName: 'Yazan Al-Arab', teamName: 'Jordan', teamCode: 'JOR', goals: 1 },
    { playerName: 'Ali Olwan', teamName: 'Jordan', teamCode: 'JOR', goals: 1 }
  ]],
  [25, [
    { playerName: 'Michal Sadilek', teamName: 'Czechia', teamCode: 'CZE', goals: 1 }
  ]],
  [26, [
    { playerName: 'Johan Manzambi', teamName: 'Switzerland', teamCode: 'SUI', goals: 1 },
    { playerName: 'Ruben Vargas', teamName: 'Switzerland', teamCode: 'SUI', goals: 1 },
    { playerName: 'Johan Manzambi', teamName: 'Switzerland', teamCode: 'SUI', goals: 1 },
    { playerName: 'Armin Mhmich', teamName: 'Bosnia and Herzegovina', teamCode: 'BIH', goals: 1 }
  ]]
]);

async function insertTeam(db: ReturnType<typeof createTempDatabase>['db'], id: string, name: string, code: string) {
  await db.run(
    `INSERT INTO teams (id, name, name_et, code, flag, group_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, name, code, '', id[0]]
  );
}

async function insertMatch(
  db: ReturnType<typeof createTempDatabase>['db'],
  id: number,
  kickoffAt: string,
  homeTeamId: string,
  awayTeamId: string,
  homeSlot: string,
  awaySlot: string
) {
  await db.run(
    `INSERT INTO matches (id, stage, group_id, kickoff_at, home_team_id, away_team_id, home_slot, away_slot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, 'group', homeSlot[0], kickoffAt, homeTeamId, awayTeamId, homeSlot, awaySlot]
  );
}

async function insertConfirmedResult(db: ReturnType<typeof createTempDatabase>['db'], matchId: number, homeScore: number, awayScore: number) {
  await db.run(
    `INSERT INTO match_results (
      match_id, home_score, away_score, confirmed_home_score, confirmed_away_score,
      confirmed_at, confirmation_source, confirmation_confidence, status, public_status,
      is_final, provider, raw_provider_status, last_checked_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      matchId,
      homeScore,
      awayScore,
      homeScore,
      awayScore,
      '2026-06-22T08:00:00.000Z',
      'open-worldcup-result-provider',
      'provider-agreement',
      'FINISHED',
      'CONFIRMED_FINAL',
      1,
      'open-worldcup-result-provider',
      'FINISHED',
      '2026-06-22T08:00:00.000Z',
      '2026-06-22T08:00:00.000Z'
    ]
  );
}
