import { createMatches, createTeams } from '../domain/seed.js';
import { rankParticipants, scoreGroupBonus, scoreKnockoutBonus, scoreMatch, sumPoints } from '../domain/scoring.js';
import { getTournamentData } from '../domain/tournamentData.js';
import { validateTournamentData } from '../domain/tournamentValidation.js';
import type { GroupBonusPrediction, KnockoutBonusPrediction, MatchPrediction, MatchResult, ParticipantScore } from '../domain/types.js';
import { getRuntimeConfig, requireDestructiveConfirmation } from './config.js';
import { createDatabase, type QueryValue } from './databaseAdapter.js';

const config = getRuntimeConfig();
export const db = createDatabase(config);

export async function migrate(): Promise<void> {
  if (db.provider === 'postgres') return migratePostgres();
  return migrateSqlite();
}

async function migrateSqlite(): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, invite_code TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'player', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, display_name TEXT NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', contact TEXT, admin_note TEXT, updated_at TEXT, approved_at TEXT);
    CREATE TABLE IF NOT EXISTS competitions (id TEXT PRIMARY KEY, name TEXT NOT NULL, prediction_deadline TEXT NOT NULL, predictions_locked INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT, flag TEXT, group_id TEXT);
    CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS matches (id INTEGER PRIMARY KEY, stage TEXT NOT NULL, group_id TEXT, kickoff_at TEXT NOT NULL, home_team_id TEXT, away_team_id TEXT, home_slot TEXT NOT NULL, away_slot TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS predictions (player_id TEXT NOT NULL, match_id INTEGER NOT NULL, home_goals INTEGER NOT NULL, away_goals INTEGER NOT NULL, penalty_winner TEXT, updated_at TEXT NOT NULL, PRIMARY KEY (player_id, match_id));
    CREATE TABLE IF NOT EXISTS prediction_submissions (player_id TEXT PRIMARY KEY, submitted_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS actual_results (match_id INTEGER PRIMARY KEY, home_goals INTEGER NOT NULL, away_goals INTEGER NOT NULL, penalty_winner TEXT, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bonus_predictions (player_id TEXT PRIMARY KEY, group_json TEXT NOT NULL, knockout_json TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bonus_results (competition_id TEXT PRIMARY KEY, group_json TEXT NOT NULL, knockout_json TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS score_breakdowns (player_id TEXT NOT NULL, item_type TEXT NOT NULL, item_id TEXT NOT NULL, points REAL NOT NULL, explanation TEXT NOT NULL, PRIMARY KEY (player_id, item_type, item_id));
    CREATE TABLE IF NOT EXISTS leaderboard_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, snapshot_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS admin_audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL, action TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL);
  `);
  for (const sql of [
    'ALTER TABLE teams ADD COLUMN code TEXT',
    'ALTER TABLE teams ADD COLUMN flag TEXT',
    "ALTER TABLE players ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'",
    'ALTER TABLE players ADD COLUMN contact TEXT',
    'ALTER TABLE players ADD COLUMN admin_note TEXT',
    'ALTER TABLE players ADD COLUMN updated_at TEXT',
    'ALTER TABLE players ADD COLUMN approved_at TEXT'
  ]) await db.exec(sql).catch(() => undefined);
  await db.run('UPDATE players SET updated_at = COALESCE(updated_at, created_at)');
}

async function migratePostgres(): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, invite_code TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'player', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, display_name TEXT NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', contact TEXT, admin_note TEXT, updated_at TEXT, approved_at TEXT);
    CREATE TABLE IF NOT EXISTS competitions (id TEXT PRIMARY KEY, name TEXT NOT NULL, prediction_deadline TEXT NOT NULL, predictions_locked INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT, flag TEXT, group_id TEXT);
    CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS matches (id INTEGER PRIMARY KEY, stage TEXT NOT NULL, group_id TEXT, kickoff_at TEXT NOT NULL, home_team_id TEXT, away_team_id TEXT, home_slot TEXT NOT NULL, away_slot TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS predictions (player_id TEXT NOT NULL, match_id INTEGER NOT NULL, home_goals INTEGER NOT NULL, away_goals INTEGER NOT NULL, penalty_winner TEXT, updated_at TEXT NOT NULL, PRIMARY KEY (player_id, match_id));
    CREATE TABLE IF NOT EXISTS prediction_submissions (player_id TEXT PRIMARY KEY, submitted_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS actual_results (match_id INTEGER PRIMARY KEY, home_goals INTEGER NOT NULL, away_goals INTEGER NOT NULL, penalty_winner TEXT, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bonus_predictions (player_id TEXT PRIMARY KEY, group_json TEXT NOT NULL, knockout_json TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bonus_results (competition_id TEXT PRIMARY KEY, group_json TEXT NOT NULL, knockout_json TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS score_breakdowns (player_id TEXT NOT NULL, item_type TEXT NOT NULL, item_id TEXT NOT NULL, points DOUBLE PRECISION NOT NULL, explanation TEXT NOT NULL, PRIMARY KEY (player_id, item_type, item_id));
    CREATE TABLE IF NOT EXISTS leaderboard_snapshots (id BIGSERIAL PRIMARY KEY, created_at TEXT NOT NULL, snapshot_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS admin_audit_log (id BIGSERIAL PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL);
  `);
  await db.run('UPDATE players SET updated_at = COALESCE(updated_at, created_at)');
}

export async function seedTournamentData(): Promise<void> {
  await migrate();
  const now = new Date().toISOString();
  await upsertCompetition(now);
  await db.exec('DELETE FROM matches; DELETE FROM groups; DELETE FROM teams;');
  for (const group of getTournamentData().groups) await upsert('groups', ['id', 'name'], [group.id, group.name], ['id']);
  for (const team of createTeams()) await upsert('teams', ['id', 'name', 'code', 'flag', 'group_id'], [team.id, team.name, team.code, team.flag, team.groupId ?? null], ['id']);
  for (const match of createMatches()) await upsert('matches', ['id', 'stage', 'group_id', 'kickoff_at', 'home_team_id', 'away_team_id', 'home_slot', 'away_slot'], [match.id, match.stage, match.groupId ?? null, match.kickoffAt, match.homeTeamId ?? null, match.awayTeamId ?? null, match.homeSlot, match.awaySlot], ['id']);
}

export async function seedDemo(options: { allowDestructive?: boolean; confirmation?: string } = {}): Promise<void> {
  await resetDevData(options);
  await seedTournamentData();
  const demo = await createPlayer('Demo Player', 'FRIENDS2026');
  await createPlayer('Admin', getRuntimeConfig().adminSecret ?? 'local-admin-secret-missing', 'admin');
  await updatePlayerStatus('admin-admin', getRuntimeConfig().adminSecret ?? '', demo.id, 'approved');
}

export async function resetDevData(options: { allowDestructive?: boolean; confirmation?: string } = {}): Promise<void> {
  assertDestructiveAllowed(options);
  await migrate();
  await db.exec(`
    DELETE FROM admin_audit_log;
    DELETE FROM leaderboard_snapshots;
    DELETE FROM score_breakdowns;
    DELETE FROM bonus_results;
    DELETE FROM bonus_predictions;
    DELETE FROM actual_results;
    DELETE FROM prediction_submissions;
    DELETE FROM predictions;
    DELETE FROM matches;
    DELETE FROM groups;
    DELETE FROM teams;
    DELETE FROM players;
    DELETE FROM users;
    DELETE FROM competitions;
  `);
}

export async function createPlayer(name: string, inviteCode: string, role = 'player', contact = '') {
  const id = slug(`${name}-${role}`);
  const now = new Date().toISOString();
  const status = role === 'admin' ? 'approved' : 'pending';
  await upsertIgnore('users', ['id', 'name', 'invite_code', 'role', 'created_at'], [id, name, inviteCode, role, now], ['id']);
  await upsertIgnore('players', ['id', 'user_id', 'display_name', 'created_at', 'status', 'contact', 'admin_note', 'updated_at', 'approved_at'], [id, id, name, now, status, contact || null, null, now, role === 'admin' ? now : null], ['id']);
  if (contact) await db.run('UPDATE players SET contact = ?, updated_at = ? WHERE id = ?', [contact, now, id]);
  const row = await one('SELECT players.status, players.contact, users.role FROM players JOIN users ON users.id = players.user_id WHERE players.id = ?', [id]);
  return { id, name, role: String(row?.role ?? role), status: String(row?.status ?? status), contact: row?.contact ?? contact };
}

export async function getState(playerId?: string) {
  const currentPlayer = playerId ? await one('SELECT players.*, users.role FROM players JOIN users ON users.id = players.user_id WHERE players.id = ?', [playerId]) : null;
  return {
    competition: await one('SELECT * FROM competitions WHERE id = ?', ['wc2026']),
    teams: await all('SELECT * FROM teams ORDER BY id'),
    groups: await all('SELECT * FROM groups ORDER BY id'),
    matches: await all('SELECT * FROM matches ORDER BY id'),
    predictions: playerId ? await all('SELECT * FROM predictions WHERE player_id = ? ORDER BY match_id', [playerId]) : [],
    bonusPrediction: playerId ? await one('SELECT * FROM bonus_predictions WHERE player_id = ?', [playerId]) : null,
    bonusResult: await one('SELECT * FROM bonus_results WHERE competition_id = ?', ['wc2026']),
    results: await all('SELECT * FROM actual_results ORDER BY match_id'),
    leaderboard: await getLeaderboard(),
    tournamentDataStatus: await getTournamentDataStatus(),
    currentPlayer,
    playerAdmin: currentPlayer?.role === 'admin' ? await getPlayerAdminRows() : [],
    lastUpdated: new Date().toISOString()
  };
}

export async function getTournamentDataStatus() {
  const tournamentData = getTournamentData();
  const validation = validateTournamentData(tournamentData);
  return { metadata: tournamentData.metadata, validation, counts: validation.counts, unresolved: validation.unresolved, riskLevel: validation.riskLevel, storage: getStorageStatus() };
}

export async function savePredictions(playerId: string, predictions: MatchPrediction[]) {
  await assertUnlocked();
  const now = new Date().toISOString();
  for (const prediction of predictions) await upsert('predictions', ['player_id', 'match_id', 'home_goals', 'away_goals', 'penalty_winner', 'updated_at'], [playerId, prediction.matchId, prediction.homeGoals, prediction.awayGoals, prediction.penaltyWinner ?? null, now], ['player_id', 'match_id']);
  await upsert('prediction_submissions', ['player_id', 'submitted_at'], [playerId, now], ['player_id']);
  await recalculateScores();
}

export async function saveBonusPrediction(playerId: string, groups: GroupBonusPrediction[], knockout: KnockoutBonusPrediction) {
  await assertUnlocked();
  await upsert('bonus_predictions', ['player_id', 'group_json', 'knockout_json', 'updated_at'], [playerId, JSON.stringify(groups), JSON.stringify(knockout), new Date().toISOString()], ['player_id']);
  await recalculateScores();
}

export async function saveResult(actor: string, result: MatchResult) {
  await upsert('actual_results', ['match_id', 'home_goals', 'away_goals', 'penalty_winner', 'updated_at'], [result.matchId, result.homeGoals, result.awayGoals, result.penaltyWinner ?? null, new Date().toISOString()], ['match_id']);
  await audit(actor, 'result.updated', result);
  await recalculateScores();
}

export async function setLock(actor: string, locked: boolean) {
  await db.run('UPDATE competitions SET predictions_locked = ?, updated_at = ? WHERE id = ?', [locked ? 1 : 0, new Date().toISOString(), 'wc2026']);
  await audit(actor, locked ? 'deadline.locked' : 'deadline.unlocked', { locked });
}

export async function setDeadline(actor: string, deadline: string) {
  if (Number.isNaN(new Date(deadline).getTime())) throw new Error('Invalid deadline');
  await db.run('UPDATE competitions SET prediction_deadline = ?, updated_at = ? WHERE id = ?', [deadline, new Date().toISOString(), 'wc2026']);
  await audit(actor, 'deadline.updated', { deadline });
}

export async function saveBonusResults(actor: string, groups: GroupBonusPrediction[], knockout: KnockoutBonusPrediction & { topScorers?: string[] }) {
  const payload = { ...knockout, topScorers: knockout.topScorers?.length ? knockout.topScorers : [knockout.topScorer] };
  await upsert('bonus_results', ['competition_id', 'group_json', 'knockout_json', 'updated_at'], ['wc2026', JSON.stringify(groups), JSON.stringify(payload), new Date().toISOString()], ['competition_id']);
  await audit(actor, 'bonus-results.updated', { groups, knockout: payload });
  await recalculateScores();
}

export async function updatePlayerStatus(actorId: string, adminCode: string, playerId: string, status: string, note = '') {
  await assertAdmin(actorId, adminCode);
  if (!['pending', 'approved', 'disabled'].includes(status)) throw new Error('Invalid player status');
  const now = new Date().toISOString();
  await db.run("UPDATE players SET status = ?, admin_note = COALESCE(NULLIF(?, ''), admin_note), updated_at = ?, approved_at = CASE WHEN ? = 'approved' THEN COALESCE(approved_at, ?) ELSE approved_at END WHERE id = ?", [status, note, now, status, now, playerId]);
  await audit(actorId, 'player.status.updated', { playerId, status, note });
  await recalculateScores();
  return getState(actorId);
}

export async function verifyAdminAccess(actorId: string, adminCode: string): Promise<void> {
  await assertAdmin(actorId, adminCode);
}

export async function recalculateScores() {
  await db.exec('DELETE FROM score_breakdowns');
  const results = new Map((await all('SELECT * FROM actual_results')).map((row) => [Number(row.match_id), row]));
  const bonusResultRow = await one('SELECT * FROM bonus_results WHERE competition_id = ?', ['wc2026']);
  const groupResults: GroupBonusPrediction[] = bonusResultRow ? JSON.parse(String(bonusResultRow.group_json)) : [];
  const knockoutResult = bonusResultRow ? JSON.parse(String(bonusResultRow.knockout_json)) : null;
  for (const player of await all('SELECT id FROM players')) {
    for (const prediction of await all('SELECT * FROM predictions WHERE player_id = ?', [String(player.id)])) {
      const actual = results.get(Number(prediction.match_id));
      if (actual) {
        const scored = scoreMatch(toPrediction(prediction), toResult(actual));
        await storeBreakdown(String(player.id), 'match', String(scored.matchId), scored.points, scored.explanation);
      }
    }
    const bonusPrediction = await one('SELECT * FROM bonus_predictions WHERE player_id = ?', [String(player.id)]);
    if (bonusPrediction && bonusResultRow && knockoutResult) {
      const predictedGroups: GroupBonusPrediction[] = JSON.parse(String(bonusPrediction.group_json));
      for (const actualGroup of groupResults) {
        const predictedGroup = predictedGroups.find((group) => group.groupId === actualGroup.groupId);
        if (predictedGroup) for (const item of scoreGroupBonus(predictedGroup, actualGroup)) await storeBreakdown(String(player.id), 'bonus', item.code, item.points, item.explanation);
      }
      const predictedKnockout: KnockoutBonusPrediction = JSON.parse(String(bonusPrediction.knockout_json));
      for (const item of scoreKnockoutBonus(predictedKnockout, knockoutResult)) await storeBreakdown(String(player.id), 'bonus', item.code, item.points, item.explanation);
    }
  }
  const snapshot = await getLeaderboard();
  await db.run('INSERT INTO leaderboard_snapshots (created_at, snapshot_json) VALUES (?, ?)', [new Date().toISOString(), JSON.stringify(snapshot)]);
  return snapshot;
}

export async function getLeaderboard(): Promise<ParticipantScore[]> {
  const previous = await one('SELECT snapshot_json FROM leaderboard_snapshots ORDER BY id DESC LIMIT 1');
  const previousRanks = new Map<string, number>();
  if (previous) JSON.parse(String(previous.snapshot_json)).forEach((score: ParticipantScore, index: number) => previousRanks.set(score.playerId, index + 1));
  const rows = await all("SELECT players.id, players.display_name, COALESCE(prediction_submissions.submitted_at, players.created_at) AS submitted_at FROM players LEFT JOIN prediction_submissions ON prediction_submissions.player_id = players.id WHERE players.status = 'approved'");
  const scores: ParticipantScore[] = [];
  for (const player of rows) {
    const breakdownRows = await all('SELECT item_type, points FROM score_breakdowns WHERE player_id = ?', [String(player.id)]);
    const matchPoints = sumPoints(breakdownRows.filter((row) => row.item_type === 'match').map((row) => ({ points: Number(row.points) })));
    const bonusPoints = sumPoints(breakdownRows.filter((row) => row.item_type === 'bonus').map((row) => ({ points: Number(row.points) })));
    scores.push({ playerId: String(player.id), name: String(player.display_name), submittedAt: String(player.submitted_at), matchPoints, bonusPoints, totalPoints: matchPoints + bonusPoints, previousRank: previousRanks.get(String(player.id)) });
  }
  return rankParticipants(scores);
}

export async function breakdownFor(playerId: string) {
  return all('SELECT * FROM score_breakdowns WHERE player_id = ? ORDER BY item_type, item_id', [playerId]);
}

export async function resetForTests() {
  await db.exec(`
    DELETE FROM admin_audit_log;
    DELETE FROM leaderboard_snapshots;
    DELETE FROM score_breakdowns;
    DELETE FROM bonus_results;
    DELETE FROM bonus_predictions;
    DELETE FROM actual_results;
    DELETE FROM prediction_submissions;
    DELETE FROM predictions;
    DELETE FROM matches;
    DELETE FROM groups;
    DELETE FROM teams;
    DELETE FROM players;
    DELETE FROM users;
    DELETE FROM competitions;
  `);
}

export function getStorageStatus() {
  return {
    mode: config.appEnv,
    database: config.databaseMode === 'sqlite' ? 'SQLite' : 'Postgres',
    dbPath: config.databaseMode === 'sqlite' ? config.sqlitePath : undefined,
    publicAppBaseUrl: config.publicAppBaseUrl,
    tournamentDataMode: config.tournamentDataMode,
    productionSafe: config.appEnv === 'production' && config.databaseMode === 'postgres',
    warning: config.databaseMode === 'sqlite' ? 'Local SQLite storage is suitable for MVP/demo use, but needs backups and persistent disk before public production use.' : ''
  };
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
    tournamentDataStatus: (await getTournamentDataStatus()).metadata.verificationStatus,
    adminSecretConfigured: Boolean(config.adminSecret)
  };
}

async function upsertCompetition(now: string): Promise<void> {
  if (db.provider === 'postgres') {
    await db.run(`INSERT INTO competitions (id, name, prediction_deadline, predictions_locked, updated_at)
      VALUES (?, ?, ?, COALESCE((SELECT predictions_locked FROM competitions WHERE id = ?), ?), ?)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, prediction_deadline = EXCLUDED.prediction_deadline, updated_at = EXCLUDED.updated_at`, ['wc2026', 'Friends World Cup 2026', '2026-06-10T20:59:00.000Z', 'wc2026', 0, now]);
  } else {
    await db.run('INSERT OR REPLACE INTO competitions VALUES (?, ?, ?, COALESCE((SELECT predictions_locked FROM competitions WHERE id = ?), ?), ?)', ['wc2026', 'Friends World Cup 2026', '2026-06-10T20:59:00.000Z', 'wc2026', 0, now]);
  }
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

async function upsertIgnore(table: string, columns: string[], values: QueryValue[], conflictColumns: string[]): Promise<void> {
  if (db.provider === 'postgres') {
    await db.run(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')}) ON CONFLICT (${conflictColumns.join(', ')}) DO NOTHING`, values);
  } else {
    await db.run(`INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, values);
  }
}

async function assertUnlocked() {
  const competition = await one('SELECT predictions_locked, prediction_deadline FROM competitions WHERE id = ?', ['wc2026']);
  if (competition?.predictions_locked === 1) throw new Error('Predictions are locked');
  if (competition?.prediction_deadline && Date.now() > new Date(String(competition.prediction_deadline)).getTime()) throw new Error('Prediction deadline has passed');
}

async function assertAdmin(actorId: string, adminCode: string) {
  const actor = await one('SELECT role FROM users WHERE id = ?', [actorId]);
  const adminSecret = getRuntimeConfig().adminSecret;
  if (!adminSecret) throw new Error('Admin secret is not configured');
  if (actor?.role !== 'admin' || adminCode !== adminSecret) throw new Error('Admin access required');
}

async function getPlayerAdminRows() {
  return all(`
    SELECT players.id, players.display_name, players.created_at, players.updated_at, players.approved_at, players.status, players.contact, players.admin_note,
      prediction_submissions.submitted_at,
      COUNT(predictions.match_id) AS prediction_count,
      CASE WHEN bonus_predictions.player_id IS NULL THEN 0 ELSE 1 END AS has_bonus_prediction,
      COUNT(*) OVER (PARTITION BY lower(players.display_name)) AS duplicate_name_count
    FROM players
    LEFT JOIN prediction_submissions ON prediction_submissions.player_id = players.id
    LEFT JOIN predictions ON predictions.player_id = players.id
    LEFT JOIN bonus_predictions ON bonus_predictions.player_id = players.id
    GROUP BY players.id, prediction_submissions.submitted_at, bonus_predictions.player_id
    ORDER BY players.status, players.created_at
  `);
}

function assertDestructiveAllowed(options: { allowDestructive?: boolean; confirmation?: string }) {
  if (!options.allowDestructive) throw new Error('Destructive reset refused. Use reset:dev or seed:demo explicitly.');
  requireDestructiveConfirmation(getRuntimeConfig(), options.confirmation);
}

async function audit(actor: string, action: string, payload: unknown) {
  await db.run('INSERT INTO admin_audit_log (actor, action, payload_json, created_at) VALUES (?, ?, ?, ?)', [actor, action, JSON.stringify(payload), new Date().toISOString()]);
}

async function storeBreakdown(playerId: string, itemType: string, itemId: string, points: number, explanation: string) {
  await upsert('score_breakdowns', ['player_id', 'item_type', 'item_id', 'points', 'explanation'], [playerId, itemType, itemId, points, explanation], ['player_id', 'item_type', 'item_id']);
}

function toPrediction(row: Record<string, unknown>): MatchPrediction {
  return { matchId: Number(row.match_id), homeGoals: Number(row.home_goals), awayGoals: Number(row.away_goals), penaltyWinner: row.penalty_winner as MatchPrediction['penaltyWinner'] };
}

function toResult(row: Record<string, unknown>): MatchResult {
  return { matchId: Number(row.match_id), homeGoals: Number(row.home_goals), awayGoals: Number(row.away_goals), penaltyWinner: row.penalty_winner as MatchResult['penaltyWinner'] };
}

function all(sql: string, values: QueryValue[] = []): Promise<Record<string, unknown>[]> {
  return db.all(sql, values);
}

function one(sql: string, values: QueryValue[] = []): Promise<Record<string, unknown> | null> {
  return db.one(sql, values);
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
