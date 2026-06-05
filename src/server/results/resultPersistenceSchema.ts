import type { QueryableDatabase } from '../databaseAdapter.js';

export async function migrateResultPersistenceSchema(db: QueryableDatabase): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS match_results (
      match_id INTEGER PRIMARY KEY,
      home_score INTEGER,
      away_score INTEGER,
      minute INTEGER,
      status TEXT NOT NULL,
      is_final INTEGER NOT NULL DEFAULT 0,
      provider TEXT,
      provider_fixture_id TEXT,
      raw_provider_status TEXT,
      last_checked_at TEXT,
      next_check_at TEXT,
      updated_at TEXT NOT NULL,
      points_recalculated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS result_updates (
      id TEXT PRIMARY KEY,
      match_id INTEGER NOT NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      home_score INTEGER,
      away_score INTEGER,
      minute INTEGER,
      is_final INTEGER NOT NULL DEFAULT 0,
      last_checked_at TEXT NOT NULL,
      next_check_at TEXT,
      points_recalculated_at TEXT,
      provider_fixture_id TEXT,
      provider_updated_at TEXT,
      raw_provider_status TEXT,
      warning TEXT,
      error_message TEXT
    );
    CREATE TABLE IF NOT EXISTS leaderboard_entries (
      player_id TEXT PRIMARY KEY,
      rank INTEGER NOT NULL,
      points INTEGER NOT NULL,
      exact_scores INTEGER NOT NULL,
      correct_results INTEGER NOT NULL,
      hit_rate REAL NOT NULL,
      matches_scored INTEGER NOT NULL DEFAULT 0,
      match_points INTEGER NOT NULL DEFAULT 0,
      group_bonus_points INTEGER NOT NULL DEFAULT 0,
      playoff_bonus_points INTEGER NOT NULL DEFAULT 0,
      top_scorer_bonus_points INTEGER NOT NULL DEFAULT 0,
      total_points INTEGER NOT NULL DEFAULT 0,
      previous_rank INTEGER,
      last_updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS leaderboard_metadata (
      id TEXT PRIMARY KEY,
      last_rebuild_at TEXT NOT NULL,
      players_processed INTEGER NOT NULL,
      matches_processed INTEGER NOT NULL,
      changed_entries INTEGER NOT NULL,
      warnings_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS result_agent_runs (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      finished_at TEXT NOT NULL,
      checked_matches INTEGER NOT NULL,
      updated_matches INTEGER NOT NULL,
      finalized_matches INTEGER NOT NULL,
      leaderboard_rebuilt INTEGER NOT NULL,
      players_processed INTEGER NOT NULL,
      warnings_json TEXT NOT NULL,
      provider TEXT NOT NULL,
      mode TEXT NOT NULL
    );
  `);

  await ensureColumn(db, 'match_results', 'minute', 'INTEGER');
  await ensureColumn(db, 'match_results', 'provider', 'TEXT');
  await ensureColumn(db, 'match_results', 'provider_fixture_id', 'TEXT');
  await ensureColumn(db, 'match_results', 'raw_provider_status', 'TEXT');
  await ensureColumn(db, 'match_results', 'last_checked_at', 'TEXT');
  await ensureColumn(db, 'match_results', 'next_check_at', 'TEXT');
  await ensureColumn(db, 'match_results', 'points_recalculated_at', 'TEXT');

  await ensureColumn(db, 'result_updates', 'home_score', 'INTEGER');
  await ensureColumn(db, 'result_updates', 'away_score', 'INTEGER');
  await ensureColumn(db, 'result_updates', 'minute', 'INTEGER');
  await ensureColumn(db, 'result_updates', 'provider_fixture_id', 'TEXT');
  await ensureColumn(db, 'result_updates', 'provider_updated_at', 'TEXT');
  await ensureColumn(db, 'result_updates', 'warning', 'TEXT');

  await ensureColumn(db, 'leaderboard_entries', 'matches_scored', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'leaderboard_entries', 'match_points', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'leaderboard_entries', 'group_bonus_points', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'leaderboard_entries', 'playoff_bonus_points', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'leaderboard_entries', 'top_scorer_bonus_points', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'leaderboard_entries', 'total_points', 'INTEGER NOT NULL DEFAULT 0');
}

async function ensureColumn(db: QueryableDatabase, table: string, column: string, definition: string): Promise<void> {
  if (await hasColumn(db, table, column)) return;
  await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

async function hasColumn(db: QueryableDatabase, table: string, column: string): Promise<boolean> {
  if (db.provider === 'sqlite') {
    const rows = await db.all(`PRAGMA table_info(${table})`);
    return rows.some((row) => row.name === column);
  }
  const row = await db.one(
    'SELECT 1 AS exists FROM information_schema.columns WHERE table_name = ? AND column_name = ?',
    [table, column]
  );
  return Boolean(row);
}
