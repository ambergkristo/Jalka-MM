import { createHash, randomUUID } from 'node:crypto';
import { createMatches, createTeams } from '../domain/seed.js';
import { derivePredictedGroupOutcomes } from '../domain/predictedGroups.js';
import { rankParticipants, scoreGroupBonus, scoreKnockoutBonus, scoreMatch, sumPoints } from '../domain/scoring.js';
import { getTournamentData } from '../domain/tournamentData.js';
import { validateTournamentData } from '../domain/tournamentValidation.js';
import type { GroupBonusPrediction, GroupTieResolution, KnockoutBonusPrediction, MatchPrediction, MatchResult, ParticipantScore } from '../domain/types.js';
import { assertSecret, hashSecret, newSessionToken, hashSessionToken, normalizeNamePart, normalizedFullName, verifySecret } from './auth.js';
import { getRuntimeConfig, requireDestructiveConfirmation } from './config.js';
import { createDatabase, type QueryValue } from './databaseAdapter.js';

const config = getRuntimeConfig();
export const db = createDatabase(config);

export async function migrate(): Promise<void> {
  if (db.provider === 'postgres') await migratePostgres();
  else await migrateSqlite();
  await bootstrapAdminAccounts();
}

async function migrateSqlite(): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, invite_code TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'player', created_at TEXT NOT NULL, password_hash TEXT);
    CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, display_name TEXT NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', contact TEXT, admin_note TEXT, updated_at TEXT, approved_at TEXT, first_name TEXT, last_name TEXT, normalized_full_name TEXT, legacy_name_only INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS admin_accounts (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, subject_id TEXT NOT NULL, subject_type TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS competitions (id TEXT PRIMARY KEY, name TEXT NOT NULL, prediction_deadline TEXT NOT NULL, predictions_locked INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, name TEXT NOT NULL, name_et TEXT, code TEXT, flag TEXT, group_id TEXT);
    CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS matches (id INTEGER PRIMARY KEY, stage TEXT NOT NULL, group_id TEXT, kickoff_at TEXT NOT NULL, home_team_id TEXT, away_team_id TEXT, home_slot TEXT NOT NULL, away_slot TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS predictions (player_id TEXT NOT NULL, match_id INTEGER NOT NULL, home_goals INTEGER NOT NULL, away_goals INTEGER NOT NULL, penalty_winner TEXT, updated_at TEXT NOT NULL, home_team_prediction_id TEXT, away_team_prediction_id TEXT, predicted_winner_team_id TEXT, needs_final_confirmation INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (player_id, match_id));
    CREATE TABLE IF NOT EXISTS group_tie_resolutions (player_id TEXT NOT NULL, group_id TEXT NOT NULL, team_order_json TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (player_id, group_id));
    CREATE TABLE IF NOT EXISTS prediction_submissions (player_id TEXT PRIMARY KEY, submitted_at TEXT, final_submitted_at TEXT, snapshot_hash TEXT, revision INTEGER NOT NULL DEFAULT 0, is_final INTEGER NOT NULL DEFAULT 0);
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
    'ALTER TABLE teams ADD COLUMN name_et TEXT',
    "ALTER TABLE players ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'",
    'ALTER TABLE players ADD COLUMN contact TEXT',
    'ALTER TABLE players ADD COLUMN admin_note TEXT',
    'ALTER TABLE players ADD COLUMN updated_at TEXT',
    'ALTER TABLE players ADD COLUMN approved_at TEXT',
    'ALTER TABLE players ADD COLUMN first_name TEXT',
    'ALTER TABLE players ADD COLUMN last_name TEXT',
    'ALTER TABLE players ADD COLUMN normalized_full_name TEXT',
    'ALTER TABLE players ADD COLUMN legacy_name_only INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE users ADD COLUMN password_hash TEXT',
    'ALTER TABLE predictions ADD COLUMN home_team_prediction_id TEXT',
    'ALTER TABLE predictions ADD COLUMN away_team_prediction_id TEXT',
    'ALTER TABLE predictions ADD COLUMN predicted_winner_team_id TEXT',
    'ALTER TABLE predictions ADD COLUMN needs_final_confirmation INTEGER NOT NULL DEFAULT 1',
    'ALTER TABLE prediction_submissions ADD COLUMN final_submitted_at TEXT',
    'ALTER TABLE prediction_submissions ADD COLUMN snapshot_hash TEXT',
    'ALTER TABLE prediction_submissions ADD COLUMN revision INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE prediction_submissions ADD COLUMN is_final INTEGER NOT NULL DEFAULT 0'
  ]) await db.exec(sql).catch(() => undefined);
  await db.run('UPDATE prediction_submissions SET final_submitted_at = COALESCE(final_submitted_at, submitted_at), is_final = CASE WHEN submitted_at IS NULL THEN is_final ELSE 1 END');
  await db.run('UPDATE players SET updated_at = COALESCE(updated_at, created_at)');
  await db.run("UPDATE players SET legacy_name_only = 1 WHERE (first_name IS NULL OR last_name IS NULL)");
}

async function migratePostgres(): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, invite_code TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'player', created_at TEXT NOT NULL, password_hash TEXT);
    CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, display_name TEXT NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', contact TEXT, admin_note TEXT, updated_at TEXT, approved_at TEXT, first_name TEXT, last_name TEXT, normalized_full_name TEXT, legacy_name_only INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS admin_accounts (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, subject_id TEXT NOT NULL, subject_type TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS competitions (id TEXT PRIMARY KEY, name TEXT NOT NULL, prediction_deadline TEXT NOT NULL, predictions_locked INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, name TEXT NOT NULL, name_et TEXT, code TEXT, flag TEXT, group_id TEXT);
    CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS matches (id INTEGER PRIMARY KEY, stage TEXT NOT NULL, group_id TEXT, kickoff_at TEXT NOT NULL, home_team_id TEXT, away_team_id TEXT, home_slot TEXT NOT NULL, away_slot TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS predictions (player_id TEXT NOT NULL, match_id INTEGER NOT NULL, home_goals INTEGER NOT NULL, away_goals INTEGER NOT NULL, penalty_winner TEXT, updated_at TEXT NOT NULL, home_team_prediction_id TEXT, away_team_prediction_id TEXT, predicted_winner_team_id TEXT, needs_final_confirmation INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (player_id, match_id));
    CREATE TABLE IF NOT EXISTS group_tie_resolutions (player_id TEXT NOT NULL, group_id TEXT NOT NULL, team_order_json TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (player_id, group_id));
    CREATE TABLE IF NOT EXISTS prediction_submissions (player_id TEXT PRIMARY KEY, submitted_at TEXT, final_submitted_at TEXT, snapshot_hash TEXT, revision INTEGER NOT NULL DEFAULT 0, is_final INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS actual_results (match_id INTEGER PRIMARY KEY, home_goals INTEGER NOT NULL, away_goals INTEGER NOT NULL, penalty_winner TEXT, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bonus_predictions (player_id TEXT PRIMARY KEY, group_json TEXT NOT NULL, knockout_json TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bonus_results (competition_id TEXT PRIMARY KEY, group_json TEXT NOT NULL, knockout_json TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS score_breakdowns (player_id TEXT NOT NULL, item_type TEXT NOT NULL, item_id TEXT NOT NULL, points DOUBLE PRECISION NOT NULL, explanation TEXT NOT NULL, PRIMARY KEY (player_id, item_type, item_id));
    CREATE TABLE IF NOT EXISTS leaderboard_snapshots (id BIGSERIAL PRIMARY KEY, created_at TEXT NOT NULL, snapshot_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS admin_audit_log (id BIGSERIAL PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL);
  `);
  await db.run('UPDATE players SET updated_at = COALESCE(updated_at, created_at)');
  await db.exec('ALTER TABLE teams ADD COLUMN IF NOT EXISTS name_et TEXT').catch(() => undefined);
  for (const sql of [
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS first_name TEXT',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS last_name TEXT',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS normalized_full_name TEXT',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS legacy_name_only INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE predictions ADD COLUMN IF NOT EXISTS home_team_prediction_id TEXT',
    'ALTER TABLE predictions ADD COLUMN IF NOT EXISTS away_team_prediction_id TEXT',
    'ALTER TABLE predictions ADD COLUMN IF NOT EXISTS predicted_winner_team_id TEXT',
    'ALTER TABLE predictions ADD COLUMN IF NOT EXISTS needs_final_confirmation INTEGER NOT NULL DEFAULT 1',
    'ALTER TABLE prediction_submissions ADD COLUMN IF NOT EXISTS final_submitted_at TEXT',
    'ALTER TABLE prediction_submissions ADD COLUMN IF NOT EXISTS snapshot_hash TEXT',
    'ALTER TABLE prediction_submissions ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE prediction_submissions ADD COLUMN IF NOT EXISTS is_final INTEGER NOT NULL DEFAULT 0'
  ]) await db.exec(sql).catch(() => undefined);
  await db.run('UPDATE prediction_submissions SET final_submitted_at = COALESCE(final_submitted_at, submitted_at), is_final = CASE WHEN submitted_at IS NULL THEN is_final ELSE 1 END');
  await db.run("UPDATE players SET legacy_name_only = 1 WHERE (first_name IS NULL OR last_name IS NULL)");
}

export async function seedTournamentData(): Promise<void> {
  await migrate();
  const now = new Date().toISOString();
  await upsertCompetition(now);
  await db.exec('DELETE FROM matches; DELETE FROM groups; DELETE FROM teams;');
  for (const group of getTournamentData().groups) await upsert('groups', ['id', 'name'], [group.id, group.name], ['id']);
  for (const team of createTeams()) await upsert('teams', ['id', 'name', 'name_et', 'code', 'flag', 'group_id'], [team.id, team.name, team.nameEt ?? team.name, team.code, team.flag, team.groupId ?? null], ['id']);
  for (const match of createMatches()) await upsert('matches', ['id', 'stage', 'group_id', 'kickoff_at', 'home_team_id', 'away_team_id', 'home_slot', 'away_slot'], [match.id, match.stage, match.groupId ?? null, match.kickoffAt, match.homeTeamId ?? null, match.awayTeamId ?? null, match.homeSlot, match.awaySlot], ['id']);
}

export async function seedDemo(options: { allowDestructive?: boolean; confirmation?: string } = {}): Promise<void> {
  await resetDevData(options);
  await seedTournamentData();
  const demo = await createPlayer('Demo Player', 'FRIENDS2026');
  await updatePlayerStatus('Kristo', demo.id, 'approved');
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
    DELETE FROM group_tie_resolutions;
    DELETE FROM actual_results;
    DELETE FROM prediction_submissions;
    DELETE FROM predictions;
    DELETE FROM matches;
    DELETE FROM groups;
    DELETE FROM teams;
    DELETE FROM players;
    DELETE FROM users;
    DELETE FROM sessions;
    DELETE FROM admin_accounts;
    DELETE FROM competitions;
  `);
}

export async function createPlayer(name: string, inviteCode: string, role = 'player', contact = '') {
  const id = slug(`${name}-${role}`);
  const now = new Date().toISOString();
  const status = role === 'admin' ? 'approved' : 'pending';
  const passwordHash = await hashSecret(`legacy-${id}-change-me`);
  await upsertIgnore('users', ['id', 'name', 'invite_code', 'role', 'created_at', 'password_hash'], [id, name, inviteCode, role, now, passwordHash], ['id']);
  await upsertIgnore('players', ['id', 'user_id', 'display_name', 'created_at', 'status', 'contact', 'admin_note', 'updated_at', 'approved_at', 'first_name', 'last_name', 'normalized_full_name', 'legacy_name_only'], [id, id, name, now, status, contact || null, null, now, role === 'admin' ? now : null, name, '', name.toLocaleLowerCase('et-EE'), 1], ['id']);
  if (contact) await db.run('UPDATE players SET contact = ?, updated_at = ? WHERE id = ?', [contact, now, id]);
  const row = await one('SELECT players.status, players.contact, users.role FROM players JOIN users ON users.id = players.user_id WHERE players.id = ?', [id]);
  return { id, name, role: String(row?.role ?? role), status: String(row?.status ?? status), contact: row?.contact ?? contact };
}

export async function registerPlayer(input: { firstName: string; lastName: string; contact?: string; inviteCode: string; password: string }) {
  const firstName = normalizeNamePart(input.firstName);
  const lastName = normalizeNamePart(input.lastName);
  if (!firstName || !lastName) throw new Error('First and last name are required');
  if (input.inviteCode !== config.leagueInviteCode) throw new Error('Invalid invite code');
  assertSecret(input.password);
  const fullName = `${firstName} ${lastName}`;
  const normalized = normalizedFullName(firstName, lastName);
  const duplicate = await one('SELECT id FROM players WHERE normalized_full_name = ?', [normalized]);
  if (duplicate) throw new Error('Player with this full name already exists');
  const id = uniqueId('player');
  const now = new Date().toISOString();
  const passwordHash = await hashSecret(input.password);
  await db.transaction(async (tx) => {
    await tx.run('INSERT INTO users (id, name, invite_code, role, created_at, password_hash) VALUES (?, ?, ?, ?, ?, ?)', [id, fullName, input.inviteCode, 'player', now, passwordHash]);
    await tx.run('INSERT INTO players (id, user_id, display_name, created_at, status, contact, admin_note, updated_at, approved_at, first_name, last_name, normalized_full_name, legacy_name_only) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, id, fullName, now, 'pending', input.contact || null, null, now, null, firstName, lastName, normalized, 0]);
  });
  return { id, name: fullName, role: 'player', status: 'pending', contact: input.contact ?? '' };
}

export async function authenticatePlayer(firstName: string, lastName: string, password: string) {
  const normalized = normalizedFullName(firstName, lastName);
  const row = await one('SELECT players.id, players.display_name, players.status, players.contact, users.role, users.password_hash FROM players JOIN users ON users.id = players.user_id WHERE players.normalized_full_name = ?', [normalized]);
  if (!row || !(await verifySecret(password, row.password_hash))) throw new Error('Invalid credentials');
  return { id: String(row.id), name: String(row.display_name), role: String(row.role), status: String(row.status), contact: row.contact ?? '' };
}

export async function bootstrapAdminAccounts(): Promise<void> {
  const now = new Date().toISOString();
  for (const username of ['Kristo', 'Argo']) {
    const configuredPassword = config.bootstrapAdminPasswords[username];
    const existing = await one('SELECT id FROM admin_accounts WHERE username = ?', [username]);
    if (!configuredPassword) continue;
    const passwordHash = await hashSecret(configuredPassword);
    if (existing) {
      await db.run('UPDATE admin_accounts SET password_hash = ?, updated_at = ? WHERE username = ?', [passwordHash, now, username]);
    } else {
      await db.run('INSERT INTO admin_accounts (id, username, display_name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [uniqueId('admin'), username, username, passwordHash, now, now]);
    }
  }
}

export async function authenticateAdmin(username: string, password: string) {
  const row = await one('SELECT id, username, display_name, password_hash FROM admin_accounts WHERE lower(username) = lower(?)', [username.trim()]);
  if (!row || !(await verifySecret(password, row.password_hash))) throw new Error('Invalid admin credentials');
  return { id: String(row.id), username: String(row.username), name: String(row.display_name), role: 'admin', status: 'approved' };
}

export async function createSession(subject: { id: string; role: string }) {
  const token = newSessionToken();
  const tokenHash = hashSessionToken(token, config.sessionSecret ?? '');
  const now = new Date();
  const expires = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);
  await db.run('INSERT INTO sessions (id, token_hash, subject_id, subject_type, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)', [uniqueId('session'), tokenHash, subject.id, subject.role === 'admin' ? 'admin' : 'player', now.toISOString(), expires.toISOString()]);
  return { token, expiresAt: expires.toISOString() };
}

export async function sessionFromToken(token: string | undefined) {
  if (!token || !config.sessionSecret) return null;
  const tokenHash = hashSessionToken(token, config.sessionSecret);
  const row = await one('SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?', [tokenHash, new Date().toISOString()]);
  if (!row) return null;
  if (row.subject_type === 'admin') {
    const admin = await one('SELECT id, username, display_name FROM admin_accounts WHERE id = ?', [String(row.subject_id)]);
    return admin ? { id: String(admin.id), name: String(admin.display_name), username: String(admin.username), role: 'admin' } : null;
  }
  const player = await one('SELECT players.id, players.display_name, players.status, users.role FROM players JOIN users ON users.id = players.user_id WHERE players.id = ?', [String(row.subject_id)]);
  return player ? { id: String(player.id), name: String(player.display_name), role: String(player.role), status: String(player.status) } : null;
}

export async function deleteSession(token: string | undefined): Promise<void> {
  if (!token || !config.sessionSecret) return;
  await db.run('DELETE FROM sessions WHERE token_hash = ?', [hashSessionToken(token, config.sessionSecret)]);
}

export async function getState(playerId?: string, admin = false) {
  const currentPlayer = playerId ? await one('SELECT players.*, users.role FROM players JOIN users ON users.id = players.user_id WHERE players.id = ?', [playerId]) : null;
  return {
    competition: await one('SELECT * FROM competitions WHERE id = ?', ['wc2026']),
    teams: await all('SELECT * FROM teams ORDER BY id'),
    groups: await all('SELECT * FROM groups ORDER BY id'),
    matches: await all('SELECT * FROM matches ORDER BY id'),
    predictions: playerId ? await all('SELECT * FROM predictions WHERE player_id = ? ORDER BY match_id', [playerId]) : [],
    tieResolutions: playerId ? await all('SELECT * FROM group_tie_resolutions WHERE player_id = ? ORDER BY group_id', [playerId]) : [],
    submission: playerId ? await one('SELECT * FROM prediction_submissions WHERE player_id = ?', [playerId]) : null,
    bonusPrediction: playerId ? await one('SELECT * FROM bonus_predictions WHERE player_id = ?', [playerId]) : null,
    bonusResult: await one('SELECT * FROM bonus_results WHERE competition_id = ?', ['wc2026']),
    results: await all('SELECT * FROM actual_results ORDER BY match_id'),
    leaderboard: await getLeaderboard(),
    tournamentDataStatus: await getTournamentDataStatus(),
    currentPlayer,
    playerAdmin: admin ? await getPlayerAdminRows() : [],
    lastUpdated: new Date().toISOString()
  };
}

export async function getTournamentDataStatus() {
  const tournamentData = getTournamentData();
  const validation = validateTournamentData(tournamentData);
  return { metadata: tournamentData.metadata, validation, counts: validation.counts, unresolved: validation.unresolved, riskLevel: validation.riskLevel, storage: getStorageStatus() };
}

export async function savePredictions(playerId: string, predictions: MatchPrediction[], tieResolutions: GroupTieResolution[] = []) {
  await assertUnlocked();
  const now = new Date().toISOString();
  for (const prediction of predictions) await upsert('predictions', ['player_id', 'match_id', 'home_goals', 'away_goals', 'penalty_winner', 'updated_at', 'home_team_prediction_id', 'away_team_prediction_id', 'predicted_winner_team_id', 'needs_final_confirmation'], [playerId, prediction.matchId, prediction.homeGoals, prediction.awayGoals, prediction.penaltyWinner ?? null, now, (prediction as any).homeTeamPredictionId ?? null, (prediction as any).awayTeamPredictionId ?? null, (prediction as any).predictedWinnerTeamId ?? null, 1], ['player_id', 'match_id']);
  await db.run('DELETE FROM group_tie_resolutions WHERE player_id = ?', [playerId]);
  for (const resolution of tieResolutions) {
    if (!resolution.groupId || !Array.isArray(resolution.teamOrder) || resolution.teamOrder.length === 0) continue;
    await upsert('group_tie_resolutions', ['player_id', 'group_id', 'team_order_json', 'updated_at'], [playerId, resolution.groupId, JSON.stringify(resolution.teamOrder), now], ['player_id', 'group_id']);
  }
  await db.run('UPDATE prediction_submissions SET is_final = 0 WHERE player_id = ?', [playerId]);
  await recalculateScores();
}

export async function submitFinalPredictions(playerId: string) {
  await assertUnlocked();
  await assertCompletePrediction(playerId);
  const now = new Date().toISOString();
  const snapshotHash = await predictionSnapshotHash(playerId);
  const existing = await one('SELECT revision FROM prediction_submissions WHERE player_id = ?', [playerId]);
  await upsert('prediction_submissions', ['player_id', 'submitted_at', 'final_submitted_at', 'snapshot_hash', 'revision', 'is_final'], [playerId, now, now, snapshotHash, Number(existing?.revision ?? 0) + 1, 1], ['player_id']);
  await db.run('UPDATE predictions SET needs_final_confirmation = 0 WHERE player_id = ?', [playerId]);
  await recalculateScores();
}

export async function saveBonusPrediction(playerId: string, groups: GroupBonusPrediction[], knockout: KnockoutBonusPrediction) {
  await assertUnlocked();
  await upsert('bonus_predictions', ['player_id', 'group_json', 'knockout_json', 'updated_at'], [playerId, JSON.stringify(groups), JSON.stringify(knockout), new Date().toISOString()], ['player_id']);
  await db.run('UPDATE prediction_submissions SET is_final = 0 WHERE player_id = ?', [playerId]);
  await recalculateScores();
}

export async function saveResult(actor: string, result: MatchResult) {
  if (!Number.isInteger(result.matchId)) throw new Error('Invalid match');
  if (!Number.isInteger(result.homeGoals) || !Number.isInteger(result.awayGoals)) throw new Error('Both result scores are required');
  if (result.homeGoals < 0 || result.awayGoals < 0) throw new Error('Result scores cannot be negative');
  await upsert('actual_results', ['match_id', 'home_goals', 'away_goals', 'penalty_winner', 'updated_at'], [result.matchId, result.homeGoals, result.awayGoals, result.penaltyWinner ?? null, new Date().toISOString()], ['match_id']);
  await audit(actor, 'result.updated', result);
  await recalculateScores();
}

export async function clearResult(actor: string, matchId: number) {
  if (!Number.isInteger(matchId)) throw new Error('Invalid match');
  await db.run('DELETE FROM actual_results WHERE match_id = ?', [matchId]);
  await audit(actor, 'match_result.cleared', { matchId });
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

export async function updatePlayerStatus(actor: string, playerId: string, status: string, note = '') {
  if (!['pending', 'approved', 'disabled'].includes(status)) throw new Error('Invalid player status');
  const now = new Date().toISOString();
  await db.run("UPDATE players SET status = ?, admin_note = COALESCE(NULLIF(?, ''), admin_note), updated_at = ?, approved_at = CASE WHEN ? = 'approved' THEN COALESCE(approved_at, ?) ELSE approved_at END WHERE id = ?", [status, note, now, status, now, playerId]);
  await audit(actor, 'player.status.updated', { playerId, status, note });
  await recalculateScores();
  return getState(undefined, true);
}

export async function deletePlayer(actor: string, playerId: string, confirmationName = '') {
  const player = await one('SELECT id, user_id, display_name, status FROM players WHERE id = ?', [playerId]);
  if (!player) throw new Error('Player not found');
  if (String(confirmationName).trim() !== String(player.display_name)) throw new Error('Player delete confirmation does not match');
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM score_breakdowns WHERE player_id = ?', [playerId]);
    await tx.run('DELETE FROM bonus_predictions WHERE player_id = ?', [playerId]);
    await tx.run('DELETE FROM group_tie_resolutions WHERE player_id = ?', [playerId]);
    await tx.run('DELETE FROM prediction_submissions WHERE player_id = ?', [playerId]);
    await tx.run('DELETE FROM predictions WHERE player_id = ?', [playerId]);
    await tx.run('DELETE FROM players WHERE id = ?', [playerId]);
    await tx.run('DELETE FROM users WHERE id = ?', [String(player.user_id)]);
    await tx.run('INSERT INTO admin_audit_log (actor, action, payload_json, created_at) VALUES (?, ?, ?, ?)', [actor, 'player.deleted', JSON.stringify({ playerId, displayName: player.display_name, status: player.status }), new Date().toISOString()]);
  });
  await recalculateScores();
  return getState(undefined, true);
}

export async function recalculateScores() {
  await db.exec('DELETE FROM score_breakdowns');
  const results = new Map((await all('SELECT * FROM actual_results')).map((row) => [Number(row.match_id), row]));
  const bonusResultRow = await one('SELECT * FROM bonus_results WHERE competition_id = ?', ['wc2026']);
  const groupResults: GroupBonusPrediction[] = bonusResultRow ? JSON.parse(String(bonusResultRow.group_json)) : [];
  const knockoutResult = bonusResultRow ? JSON.parse(String(bonusResultRow.knockout_json)) : null;
  const teams = await all('SELECT id, name, name_et, code, flag, group_id FROM teams ORDER BY id');
  const matches = await all('SELECT id, stage, group_id, kickoff_at, home_team_id, away_team_id, home_slot, away_slot FROM matches ORDER BY id');
  for (const player of await all('SELECT id FROM players')) {
    const storedPredictions = await all('SELECT * FROM predictions WHERE player_id = ?', [String(player.id)]);
    for (const prediction of storedPredictions) {
      const actual = results.get(Number(prediction.match_id));
      if (actual) {
        const scored = scoreMatch(toPrediction(prediction), toResult(actual));
        await storeBreakdown(String(player.id), 'match', String(scored.matchId), scored.points, scored.explanation);
      }
    }
    const bonusPrediction = await one('SELECT * FROM bonus_predictions WHERE player_id = ?', [String(player.id)]);
    if (bonusResultRow) {
      const tieResolutions = await tieResolutionsFor(String(player.id));
      const predictedGroups = derivePredictedGroupOutcomes(teams as any, matches as any, storedPredictions.map(toPrediction), tieResolutions).groupBonuses;
      for (const actualGroup of groupResults) {
        const predictedGroup = predictedGroups.find((group) => group.groupId === actualGroup.groupId);
        if (predictedGroup) for (const item of scoreGroupBonus(predictedGroup, actualGroup)) await storeBreakdown(String(player.id), 'bonus', item.code, item.points, item.explanation);
      }
    }
    if (bonusPrediction && bonusResultRow && knockoutResult) {
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
  const rows = await all("SELECT players.id, players.display_name, prediction_submissions.final_submitted_at AS submitted_at FROM players JOIN prediction_submissions ON prediction_submissions.player_id = players.id AND prediction_submissions.is_final = 1 WHERE players.status = 'approved'");
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
    DELETE FROM group_tie_resolutions;
    DELETE FROM actual_results;
    DELETE FROM prediction_submissions;
    DELETE FROM predictions;
    DELETE FROM matches;
    DELETE FROM groups;
    DELETE FROM teams;
    DELETE FROM players;
    DELETE FROM users;
    DELETE FROM sessions;
    DELETE FROM admin_accounts;
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
    warning: config.databaseMode === 'sqlite' ? 'Kohalik SQLite sobib arenduseks ja demoks, kuid avalikuks kasutuseks on vaja püsivat andmebaasi ning varukoopiaid.' : ''
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
    adminSecretConfigured: false,
    sessionSecretConfigured: Boolean(config.sessionSecret),
    namedAdminAccounts: Number((await one('SELECT COUNT(*) AS count FROM admin_accounts'))?.count ?? 0)
  };
}

async function upsertCompetition(now: string): Promise<void> {
  const predictionDeadline = '2026-06-11T19:00:00.000Z';
  if (db.provider === 'postgres') {
    await db.run(`INSERT INTO competitions (id, name, prediction_deadline, predictions_locked, updated_at)
      VALUES (?, ?, ?, COALESCE((SELECT predictions_locked FROM competitions WHERE id = ?), ?), ?)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, prediction_deadline = EXCLUDED.prediction_deadline, updated_at = EXCLUDED.updated_at`, ['wc2026', 'Friends World Cup 2026', predictionDeadline, 'wc2026', 0, now]);
  } else {
    await db.run('INSERT OR REPLACE INTO competitions VALUES (?, ?, ?, COALESCE((SELECT predictions_locked FROM competitions WHERE id = ?), ?), ?)', ['wc2026', 'Friends World Cup 2026', predictionDeadline, 'wc2026', 0, now]);
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

async function assertCompletePrediction(playerId: string) {
  const matchCount = Number((await one('SELECT COUNT(*) AS count FROM matches'))?.count ?? 0);
  const predictionCount = Number((await one('SELECT COUNT(*) AS count FROM predictions WHERE player_id = ?', [playerId]))?.count ?? 0);
  if (matchCount === 0 || predictionCount < matchCount) throw new Error('Final prediction is incomplete');
  const missingKnockoutTeams = Number((await one("SELECT COUNT(*) AS count FROM predictions JOIN matches ON matches.id = predictions.match_id WHERE predictions.player_id = ? AND matches.stage <> 'GROUP' AND (home_team_prediction_id IS NULL OR away_team_prediction_id IS NULL)", [playerId]))?.count ?? 0);
  if (missingKnockoutTeams > 0) throw new Error('Final prediction is incomplete');
  const duplicateKnockoutTeam = Number((await one("SELECT COUNT(*) AS count FROM predictions JOIN matches ON matches.id = predictions.match_id WHERE predictions.player_id = ? AND matches.stage <> 'GROUP' AND home_team_prediction_id = away_team_prediction_id", [playerId]))?.count ?? 0);
  if (duplicateKnockoutTeam > 0) throw new Error('Same country cannot be selected twice in one knockout match');
  const tiedWithoutWinner = Number((await one("SELECT COUNT(*) AS count FROM predictions JOIN matches ON matches.id = predictions.match_id WHERE predictions.player_id = ? AND matches.stage <> 'GROUP' AND home_goals = away_goals AND penalty_winner IS NULL", [playerId]))?.count ?? 0);
  if (tiedWithoutWinner > 0) throw new Error('Penalty winner is required');
  const invalidPenaltyWinner = Number((await one("SELECT COUNT(*) AS count FROM predictions JOIN matches ON matches.id = predictions.match_id WHERE predictions.player_id = ? AND matches.stage <> 'GROUP' AND home_goals = away_goals AND penalty_winner IS NOT NULL AND penalty_winner NOT IN ('HOME', 'AWAY')", [playerId]))?.count ?? 0);
  if (invalidPenaltyWinner > 0) throw new Error('Penalty winner must be one of the selected match teams');
  const missingPredictedWinner = Number((await one("SELECT COUNT(*) AS count FROM predictions JOIN matches ON matches.id = predictions.match_id WHERE predictions.player_id = ? AND matches.stage <> 'GROUP' AND predicted_winner_team_id IS NULL", [playerId]))?.count ?? 0);
  if (missingPredictedWinner > 0) throw new Error('Final prediction is incomplete');
  const teams = await all('SELECT id, name, name_et, code, flag, group_id FROM teams ORDER BY id');
  const matches = await all('SELECT id, stage, group_id, kickoff_at, home_team_id, away_team_id, home_slot, away_slot FROM matches ORDER BY id');
  const storedPredictions = await all('SELECT * FROM predictions WHERE player_id = ? ORDER BY match_id', [playerId]);
  const derivedGroups = derivePredictedGroupOutcomes(teams as any, matches as any, storedPredictions.map(toPrediction), await tieResolutionsFor(playerId));
  if (derivedGroups.groupBonuses.length < 12 || derivedGroups.advancingThirdPlaceTeamIds.length !== 8 || derivedGroups.unresolvedTies.length > 0) throw new Error('Group tie resolution is required');
  const bonus = await one('SELECT * FROM bonus_predictions WHERE player_id = ?', [playerId]);
  if (!bonus) throw new Error('Final prediction is incomplete');
  const knockout: KnockoutBonusPrediction = JSON.parse(String(bonus.knockout_json));
  if (knockout.r16TeamIds.length < 16 || knockout.qfTeamIds.length < 8 || knockout.sfTeamIds.length < 4 || knockout.finalTeamIds.length < 2) throw new Error('Final prediction is incomplete');
  if (!knockout.championTeamId || !knockout.thirdPlaceWinnerTeamId || !knockout.topScorer) throw new Error('Final prediction is incomplete');
}

async function predictionSnapshotHash(playerId: string): Promise<string> {
  const predictions = await all('SELECT * FROM predictions WHERE player_id = ? ORDER BY match_id', [playerId]);
  const bonus = await one('SELECT * FROM bonus_predictions WHERE player_id = ?', [playerId]);
  const tieResolutions = await tieResolutionsFor(playerId);
  return createHash('sha256').update(JSON.stringify({ predictions, bonus, tieResolutions })).digest('hex');
}

async function tieResolutionsFor(playerId: string): Promise<GroupTieResolution[]> {
  return (await all('SELECT group_id, team_order_json FROM group_tie_resolutions WHERE player_id = ? ORDER BY group_id', [playerId]))
    .map((row) => ({ groupId: String(row.group_id), teamOrder: JSON.parse(String(row.team_order_json)) }));
}

async function getPlayerAdminRows() {
  return all(`
    SELECT players.id, players.display_name, players.first_name, players.last_name, players.normalized_full_name, players.legacy_name_only,
      players.created_at, players.updated_at, players.approved_at, players.status, players.contact, players.admin_note,
      prediction_submissions.final_submitted_at,
      prediction_submissions.is_final,
      prediction_submissions.revision,
      COUNT(predictions.match_id) AS prediction_count,
      CASE WHEN bonus_predictions.player_id IS NULL THEN 0 ELSE 1 END AS has_bonus_prediction,
      COUNT(*) OVER (PARTITION BY lower(players.display_name)) AS duplicate_name_count
    FROM players
    LEFT JOIN prediction_submissions ON prediction_submissions.player_id = players.id
    LEFT JOIN predictions ON predictions.player_id = players.id
    LEFT JOIN bonus_predictions ON bonus_predictions.player_id = players.id
    GROUP BY players.id, prediction_submissions.final_submitted_at, prediction_submissions.is_final, prediction_submissions.revision, bonus_predictions.player_id
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
  return { matchId: Number(row.match_id), homeGoals: Number(row.home_goals), awayGoals: Number(row.away_goals), penaltyWinner: row.penalty_winner ? row.penalty_winner as MatchPrediction['penaltyWinner'] : undefined, homeTeamPredictionId: row.home_team_prediction_id ? String(row.home_team_prediction_id) : undefined, awayTeamPredictionId: row.away_team_prediction_id ? String(row.away_team_prediction_id) : undefined, predictedWinnerTeamId: row.predicted_winner_team_id ? String(row.predicted_winner_team_id) : undefined };
}

function toResult(row: Record<string, unknown>): MatchResult {
  return { matchId: Number(row.match_id), homeGoals: Number(row.home_goals), awayGoals: Number(row.away_goals), penaltyWinner: row.penalty_winner ? row.penalty_winner as MatchResult['penaltyWinner'] : undefined };
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

function uniqueId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}
