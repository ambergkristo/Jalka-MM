import { randomUUID } from 'node:crypto';
import { createMatches, createTeams } from '../domain/seed.js';
import { getTournamentData } from '../domain/tournamentData.js';
import type { Match } from '../domain/types.js';
import { getRuntimeConfig, requireDestructiveConfirmation } from './config.js';
import { createDatabase, type QueryValue } from './databaseAdapter.js';
import { migrateResultPersistenceSchema } from './results/resultPersistenceSchema.js';

const config = getRuntimeConfig();
export const db = createDatabase(config);

export async function migrate(): Promise<void> {
  if (db.provider === 'postgres') await migratePostgres();
  else await migrateSqlite();
  await migrateResultPersistenceSchema(db);
}

async function migrateSqlite(): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, name TEXT NOT NULL, location TEXT, avatar_url TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, name TEXT NOT NULL, name_et TEXT, code TEXT, flag TEXT, group_id TEXT);
    CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS matches (id INTEGER PRIMARY KEY, stage TEXT NOT NULL, group_id TEXT, kickoff_at TEXT NOT NULL, home_team_id TEXT, away_team_id TEXT, home_slot TEXT NOT NULL, away_slot TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS player_match_predictions (player_id TEXT NOT NULL, match_id INTEGER NOT NULL, home_score INTEGER NOT NULL, away_score INTEGER NOT NULL, predicted_home_team_id TEXT, predicted_away_team_id TEXT, predicted_winner_team_id TEXT, penalty_winner TEXT, PRIMARY KEY (player_id, match_id));
    CREATE TABLE IF NOT EXISTS player_knockout_predictions (player_id TEXT PRIMARY KEY, prediction_json TEXT NOT NULL, imported_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS group_predictions (player_id TEXT NOT NULL, group_id TEXT NOT NULL, winner_team_id TEXT NOT NULL, runner_up_team_id TEXT NOT NULL, third_place_team_id TEXT, advancing_team_ids_json TEXT NOT NULL, PRIMARY KEY (player_id, group_id));
    CREATE TABLE IF NOT EXISTS awards_predictions (player_id TEXT PRIMARY KEY, champion_team_id TEXT NOT NULL, top_scorer_name TEXT NOT NULL, top_scorer_team_id TEXT);
    CREATE TABLE IF NOT EXISTS match_results (match_id INTEGER PRIMARY KEY, home_score INTEGER, away_score INTEGER, minute INTEGER, status TEXT NOT NULL, public_status TEXT NOT NULL DEFAULT 'SCHEDULED', is_final INTEGER NOT NULL DEFAULT 0, provisional_home_score INTEGER, provisional_away_score INTEGER, provisional_status TEXT, confirmed_home_score INTEGER, confirmed_away_score INTEGER, confirmed_at TEXT, confirmation_source TEXT, confirmation_confidence TEXT, needs_review_reason TEXT, provider TEXT, provider_fixture_id TEXT, raw_provider_status TEXT, last_checked_at TEXT, last_provider_check_at TEXT, next_check_at TEXT, next_confirmation_check_at TEXT, provider_results_json TEXT, updated_at TEXT NOT NULL, points_recalculated_at TEXT);
    CREATE TABLE IF NOT EXISTS result_updates (id TEXT PRIMARY KEY, match_id INTEGER NOT NULL, source TEXT NOT NULL, status TEXT NOT NULL, home_score INTEGER, away_score INTEGER, minute INTEGER, is_final INTEGER NOT NULL DEFAULT 0, last_checked_at TEXT NOT NULL, next_check_at TEXT, points_recalculated_at TEXT, provider_fixture_id TEXT, provider_updated_at TEXT, raw_provider_status TEXT, warning TEXT, error_message TEXT);
    CREATE TABLE IF NOT EXISTS leaderboard_entries (player_id TEXT PRIMARY KEY, rank INTEGER NOT NULL, points INTEGER NOT NULL, exact_scores INTEGER NOT NULL, correct_results INTEGER NOT NULL, hit_rate REAL NOT NULL, matches_scored INTEGER NOT NULL DEFAULT 0, match_points INTEGER NOT NULL DEFAULT 0, group_bonus_points INTEGER NOT NULL DEFAULT 0, playoff_bonus_points INTEGER NOT NULL DEFAULT 0, top_scorer_bonus_points INTEGER NOT NULL DEFAULT 0, total_points INTEGER NOT NULL DEFAULT 0, previous_rank INTEGER, last_updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS leaderboard_metadata (id TEXT PRIMARY KEY, last_rebuild_at TEXT NOT NULL, players_processed INTEGER NOT NULL, matches_processed INTEGER NOT NULL, changed_entries INTEGER NOT NULL, warnings_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS group_standings (group_id TEXT NOT NULL, team_id TEXT NOT NULL, rank INTEGER NOT NULL, played INTEGER NOT NULL, wins INTEGER NOT NULL, draws INTEGER NOT NULL, losses INTEGER NOT NULL, goals_for INTEGER NOT NULL, goals_against INTEGER NOT NULL, goal_difference INTEGER NOT NULL, points INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (group_id, team_id));
    CREATE TABLE IF NOT EXISTS top_scorer_standings (id TEXT PRIMARY KEY, rank INTEGER NOT NULL, player_id TEXT, provider_player_id TEXT, player_name TEXT NOT NULL, team_id TEXT, goals INTEGER NOT NULL, assists INTEGER, minutes_played INTEGER, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS result_manual_scorers (id TEXT PRIMARY KEY, match_id INTEGER NOT NULL, player_id TEXT, provider_player_id TEXT, raw_player_name TEXT, player_name TEXT NOT NULL, team_id TEXT, team_code TEXT, goals INTEGER NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS result_manual_corrections (id TEXT PRIMARY KEY, match_id INTEGER NOT NULL, previous_home_score INTEGER, previous_away_score INTEGER, new_home_score INTEGER NOT NULL, new_away_score INTEGER NOT NULL, previous_status TEXT, new_status TEXT NOT NULL, source TEXT NOT NULL, confirmed_by TEXT NOT NULL, decided_after TEXT, penalty_winner_team_id TEXT, penalty_winner_team_code TEXT, notes TEXT, scorers_json TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS public_state_metadata (id TEXT PRIMARY KEY, last_public_dashboard_read_at TEXT, last_public_snapshot_rebuild_at TEXT, last_repair_action TEXT, last_repair_action_at TEXT, last_repair_action_status TEXT, last_repair_action_error TEXT);
  `);
}

async function migratePostgres(): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, name TEXT NOT NULL, location TEXT, avatar_url TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, name TEXT NOT NULL, name_et TEXT, code TEXT, flag TEXT, group_id TEXT);
    CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS matches (id INTEGER PRIMARY KEY, stage TEXT NOT NULL, group_id TEXT, kickoff_at TEXT NOT NULL, home_team_id TEXT, away_team_id TEXT, home_slot TEXT NOT NULL, away_slot TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS player_match_predictions (player_id TEXT NOT NULL, match_id INTEGER NOT NULL, home_score INTEGER NOT NULL, away_score INTEGER NOT NULL, predicted_home_team_id TEXT, predicted_away_team_id TEXT, predicted_winner_team_id TEXT, penalty_winner TEXT, PRIMARY KEY (player_id, match_id));
    CREATE TABLE IF NOT EXISTS player_knockout_predictions (player_id TEXT PRIMARY KEY, prediction_json TEXT NOT NULL, imported_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS group_predictions (player_id TEXT NOT NULL, group_id TEXT NOT NULL, winner_team_id TEXT NOT NULL, runner_up_team_id TEXT NOT NULL, third_place_team_id TEXT, advancing_team_ids_json TEXT NOT NULL, PRIMARY KEY (player_id, group_id));
    CREATE TABLE IF NOT EXISTS awards_predictions (player_id TEXT PRIMARY KEY, champion_team_id TEXT NOT NULL, top_scorer_name TEXT NOT NULL, top_scorer_team_id TEXT);
    CREATE TABLE IF NOT EXISTS match_results (match_id INTEGER PRIMARY KEY, home_score INTEGER, away_score INTEGER, minute INTEGER, status TEXT NOT NULL, public_status TEXT NOT NULL DEFAULT 'SCHEDULED', is_final INTEGER NOT NULL DEFAULT 0, provisional_home_score INTEGER, provisional_away_score INTEGER, provisional_status TEXT, confirmed_home_score INTEGER, confirmed_away_score INTEGER, confirmed_at TEXT, confirmation_source TEXT, confirmation_confidence TEXT, needs_review_reason TEXT, provider TEXT, provider_fixture_id TEXT, raw_provider_status TEXT, last_checked_at TEXT, last_provider_check_at TEXT, next_check_at TEXT, next_confirmation_check_at TEXT, provider_results_json TEXT, updated_at TEXT NOT NULL, points_recalculated_at TEXT);
    CREATE TABLE IF NOT EXISTS result_updates (id TEXT PRIMARY KEY, match_id INTEGER NOT NULL, source TEXT NOT NULL, status TEXT NOT NULL, home_score INTEGER, away_score INTEGER, minute INTEGER, is_final INTEGER NOT NULL DEFAULT 0, last_checked_at TEXT NOT NULL, next_check_at TEXT, points_recalculated_at TEXT, provider_fixture_id TEXT, provider_updated_at TEXT, raw_provider_status TEXT, warning TEXT, error_message TEXT);
    CREATE TABLE IF NOT EXISTS leaderboard_entries (player_id TEXT PRIMARY KEY, rank INTEGER NOT NULL, points INTEGER NOT NULL, exact_scores INTEGER NOT NULL, correct_results INTEGER NOT NULL, hit_rate DOUBLE PRECISION NOT NULL, matches_scored INTEGER NOT NULL DEFAULT 0, match_points INTEGER NOT NULL DEFAULT 0, group_bonus_points INTEGER NOT NULL DEFAULT 0, playoff_bonus_points INTEGER NOT NULL DEFAULT 0, top_scorer_bonus_points INTEGER NOT NULL DEFAULT 0, total_points INTEGER NOT NULL DEFAULT 0, previous_rank INTEGER, last_updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS leaderboard_metadata (id TEXT PRIMARY KEY, last_rebuild_at TEXT NOT NULL, players_processed INTEGER NOT NULL, matches_processed INTEGER NOT NULL, changed_entries INTEGER NOT NULL, warnings_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS group_standings (group_id TEXT NOT NULL, team_id TEXT NOT NULL, rank INTEGER NOT NULL, played INTEGER NOT NULL, wins INTEGER NOT NULL, draws INTEGER NOT NULL, losses INTEGER NOT NULL, goals_for INTEGER NOT NULL, goals_against INTEGER NOT NULL, goal_difference INTEGER NOT NULL, points INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (group_id, team_id));
    CREATE TABLE IF NOT EXISTS top_scorer_standings (id TEXT PRIMARY KEY, rank INTEGER NOT NULL, player_id TEXT, provider_player_id TEXT, player_name TEXT NOT NULL, team_id TEXT, goals INTEGER NOT NULL, assists INTEGER, minutes_played INTEGER, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS result_manual_scorers (id TEXT PRIMARY KEY, match_id INTEGER NOT NULL, player_id TEXT, provider_player_id TEXT, raw_player_name TEXT, player_name TEXT NOT NULL, team_id TEXT, team_code TEXT, goals INTEGER NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS result_manual_corrections (id TEXT PRIMARY KEY, match_id INTEGER NOT NULL, previous_home_score INTEGER, previous_away_score INTEGER, new_home_score INTEGER NOT NULL, new_away_score INTEGER NOT NULL, previous_status TEXT, new_status TEXT NOT NULL, source TEXT NOT NULL, confirmed_by TEXT NOT NULL, decided_after TEXT, penalty_winner_team_id TEXT, penalty_winner_team_code TEXT, notes TEXT, scorers_json TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS public_state_metadata (id TEXT PRIMARY KEY, last_public_dashboard_read_at TEXT, last_public_snapshot_rebuild_at TEXT, last_repair_action TEXT, last_repair_action_at TEXT, last_repair_action_status TEXT, last_repair_action_error TEXT);
  `);
}

export async function seedTournamentData(): Promise<void> {
  await migrate();
  await db.exec('DELETE FROM matches; DELETE FROM groups; DELETE FROM teams;');
  for (const group of getTournamentData().groups) await upsert('groups', ['id', 'name'], [group.id, group.name], ['id']);
  for (const team of createTeams()) await upsert('teams', ['id', 'name', 'name_et', 'code', 'flag', 'group_id'], [team.id, team.name, team.nameEt ?? team.name, team.code, team.flag, team.groupId ?? null], ['id']);
  for (const match of createMatches()) await upsert('matches', ['id', 'stage', 'group_id', 'kickoff_at', 'home_team_id', 'away_team_id', 'home_slot', 'away_slot'], [match.id, match.stage, match.groupId ?? null, match.kickoffAt, match.homeTeamId ?? null, match.awayTeamId ?? null, match.homeSlot, match.awaySlot], ['id']);
}

export async function resetDevData(options: { allowDestructive?: boolean; confirmation?: string } = {}): Promise<void> {
  assertDestructiveAllowed(options);
  await migrate();
  await db.exec(`
    DELETE FROM top_scorer_standings;
    DELETE FROM result_manual_scorers;
    DELETE FROM result_manual_corrections;
    DELETE FROM group_standings;
    DELETE FROM leaderboard_metadata;
    DELETE FROM leaderboard_entries;
    DELETE FROM result_updates;
    DELETE FROM match_results;
    DELETE FROM result_agent_runs;
    DELETE FROM public_state_metadata;
    DELETE FROM awards_predictions;
    DELETE FROM group_predictions;
    DELETE FROM player_knockout_predictions;
    DELETE FROM player_match_predictions;
    DELETE FROM matches;
    DELETE FROM groups;
    DELETE FROM teams;
    DELETE FROM players;
  `);
}

export async function getPublicState() {
  await migrate();
  return {
    status: 'ok',
    tournamentDataStatus: getTournamentData().metadata.verificationStatus,
    generatedAt: new Date().toISOString(),
    routes: ['/', '/leaderboard', '/player/:playerId', '/results', '/tournament', '/not-found']
  };
}

export async function getTournamentSummary() {
  await migrate();
  const teams = Number((await one('SELECT COUNT(*) AS count FROM teams'))?.count ?? 0);
  const groups = Number((await one('SELECT COUNT(*) AS count FROM groups'))?.count ?? 0);
  const matches = Number((await one('SELECT COUNT(*) AS count FROM matches'))?.count ?? 0);
  return { teams, groups, matches };
}

export async function healthCheck() {
  let databaseConnectivity = false;
  try {
    await one('SELECT 1 AS ok');
    databaseConnectivity = true;
  } catch {
    databaseConnectivity = false;
  }
  return {
    status: databaseConnectivity ? 'ok' : 'degraded',
    databaseMode: config.databaseMode,
    databaseConnectivity,
    tournamentDataStatus: getTournamentData().metadata.verificationStatus,
    publicReadOnly: true,
    authEnabled: false,
    generatedAt: new Date().toISOString()
  };
}

export function getStorageStatus() {
  return {
    mode: config.appEnv,
    database: config.databaseMode === 'sqlite' ? 'SQLite' : 'Postgres',
    dbPath: config.databaseMode === 'sqlite' ? config.sqlitePath : undefined,
    publicAppBaseUrl: config.publicAppBaseUrl,
    tournamentDataMode: config.tournamentDataMode,
    productionSafe: config.appEnv === 'production' && config.databaseMode === 'postgres',
    warning: config.databaseMode === 'sqlite' ? 'Local SQLite is for development only. Public production should use a persistent database with backups.' : ''
  };
}

export async function recordResultUpdate(input: { matchId: number; source: string; status: string; isFinal?: boolean; nextCheckAt?: string; rawProviderStatus?: string; errorMessage?: string }) {
  await migrate();
  const id = `result-update-${randomUUID()}`;
  await upsert(
    'result_updates',
    ['id', 'match_id', 'source', 'status', 'is_final', 'last_checked_at', 'next_check_at', 'points_recalculated_at', 'raw_provider_status', 'error_message'],
    [id, input.matchId, input.source, input.status, input.isFinal ? 1 : 0, new Date().toISOString(), input.nextCheckAt ?? null, null, input.rawProviderStatus ?? null, input.errorMessage ?? null],
    ['id']
  );
  return id;
}

export function toPublicMatch(row: Record<string, unknown>): Match {
  return {
    id: Number(row.id),
    stage: row.stage as Match['stage'],
    groupId: row.group_id ? String(row.group_id) : undefined,
    kickoffAt: String(row.kickoff_at),
    homeTeamId: row.home_team_id ? String(row.home_team_id) : undefined,
    awayTeamId: row.away_team_id ? String(row.away_team_id) : undefined,
    homeSlot: String(row.home_slot),
    awaySlot: String(row.away_slot)
  };
}

async function upsert(table: string, columns: string[], values: QueryValue[], conflictColumns: string[]): Promise<void> {
  if (db.provider === 'postgres') {
    const updateColumns = columns.filter((column) => !conflictColumns.includes(column));
    await db.run(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})
      ON CONFLICT (${conflictColumns.join(', ')}) DO UPDATE SET ${updateColumns.map((column) => `${column} = EXCLUDED.${column}`).join(', ')}`, values);
  } else {
    await db.run(`INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, values);
  }
}

function assertDestructiveAllowed(options: { allowDestructive?: boolean; confirmation?: string }) {
  if (!options.allowDestructive) throw new Error('Destructive reset refused. Use reset:dev explicitly.');
  requireDestructiveConfirmation(getRuntimeConfig(), options.confirmation);
}

function one(sql: string, values: QueryValue[] = []): Promise<Record<string, unknown> | null> {
  return db.one(sql, values);
}
