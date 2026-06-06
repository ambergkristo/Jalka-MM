import type { QueryableDatabase } from '../databaseAdapter.js';

export async function migrateResultPersistenceSchema(db: QueryableDatabase): Promise<void> {
  await db.exec(`
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
    CREATE TABLE IF NOT EXISTS group_standings (
      group_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      rank INTEGER NOT NULL,
      played INTEGER NOT NULL,
      wins INTEGER NOT NULL,
      draws INTEGER NOT NULL,
      losses INTEGER NOT NULL,
      goals_for INTEGER NOT NULL,
      goals_against INTEGER NOT NULL,
      goal_difference INTEGER NOT NULL,
      points INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (group_id, team_id)
    );
    CREATE TABLE IF NOT EXISTS top_scorer_standings (
      id TEXT PRIMARY KEY,
      rank INTEGER NOT NULL,
      player_name TEXT NOT NULL,
      team_id TEXT,
      goals INTEGER NOT NULL,
      assists INTEGER,
      minutes_played INTEGER,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS result_manual_corrections (
      id TEXT PRIMARY KEY,
      match_id INTEGER NOT NULL,
      previous_home_score INTEGER,
      previous_away_score INTEGER,
      new_home_score INTEGER NOT NULL,
      new_away_score INTEGER NOT NULL,
      previous_status TEXT,
      new_status TEXT NOT NULL,
      source TEXT NOT NULL,
      confirmed_by TEXT NOT NULL,
      decided_after TEXT,
      penalty_winner_team_id TEXT,
      penalty_winner_team_code TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await ensureColumn(db, 'match_results', 'minute', 'INTEGER');
  await ensureColumn(db, 'match_results', 'public_status', "TEXT NOT NULL DEFAULT 'SCHEDULED'");
  await ensureColumn(db, 'match_results', 'provisional_home_score', 'INTEGER');
  await ensureColumn(db, 'match_results', 'provisional_away_score', 'INTEGER');
  await ensureColumn(db, 'match_results', 'provisional_status', 'TEXT');
  await ensureColumn(db, 'match_results', 'confirmed_home_score', 'INTEGER');
  await ensureColumn(db, 'match_results', 'confirmed_away_score', 'INTEGER');
  await ensureColumn(db, 'match_results', 'confirmed_at', 'TEXT');
  await ensureColumn(db, 'match_results', 'confirmation_source', 'TEXT');
  await ensureColumn(db, 'match_results', 'confirmation_confidence', 'TEXT');
  await ensureColumn(db, 'match_results', 'needs_review_reason', 'TEXT');
  await ensureColumn(db, 'match_results', 'provider', 'TEXT');
  await ensureColumn(db, 'match_results', 'provider_fixture_id', 'TEXT');
  await ensureColumn(db, 'match_results', 'raw_provider_status', 'TEXT');
  await ensureColumn(db, 'match_results', 'last_checked_at', 'TEXT');
  await ensureColumn(db, 'match_results', 'last_provider_check_at', 'TEXT');
  await ensureColumn(db, 'match_results', 'next_check_at', 'TEXT');
  await ensureColumn(db, 'match_results', 'next_confirmation_check_at', 'TEXT');
  await ensureColumn(db, 'match_results', 'provider_results_json', 'TEXT');
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

  await ensureColumn(db, 'result_manual_corrections', 'decided_after', 'TEXT');
  await ensureColumn(db, 'result_manual_corrections', 'penalty_winner_team_id', 'TEXT');
  await ensureColumn(db, 'result_manual_corrections', 'penalty_winner_team_code', 'TEXT');
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
