import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { createMatches, createTeams } from '../domain/seed.js';
import { rankParticipants, scoreGroupBonus, scoreKnockoutBonus, scoreMatch, sumPoints } from '../domain/scoring.js';
import type { GroupBonusPrediction, KnockoutBonusPrediction, MatchPrediction, MatchResult, ParticipantScore } from '../domain/types.js';

const dbPath = join(process.cwd(), 'data', 'worldcup2026.sqlite');
mkdirSync(dirname(dbPath), { recursive: true });
export const db = new DatabaseSync(dbPath);

export function migrate(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, invite_code TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'player', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, display_name TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS competitions (id TEXT PRIMARY KEY, name TEXT NOT NULL, prediction_deadline TEXT NOT NULL, predictions_locked INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, name TEXT NOT NULL, group_id TEXT);
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
}

export function seedDemo(): void {
  migrate();
  const now = new Date().toISOString();
  db.prepare('INSERT OR REPLACE INTO competitions VALUES (?, ?, ?, COALESCE((SELECT predictions_locked FROM competitions WHERE id = ?), ?), ?)').run('wc2026', 'Friends World Cup 2026', '2026-06-10T20:59:00.000Z', 'wc2026', 0, now);
  for (const groupId of Array.from({ length: 12 }, (_, index) => String.fromCharCode(65 + index))) db.prepare('INSERT OR REPLACE INTO groups VALUES (?, ?)').run(groupId, `Group ${groupId}`);
  for (const team of createTeams()) db.prepare('INSERT OR REPLACE INTO teams VALUES (?, ?, ?)').run(team.id, team.name, team.groupId ?? null);
  for (const match of createMatches()) db.prepare('INSERT OR REPLACE INTO matches VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(match.id, match.stage, match.groupId ?? null, match.kickoffAt, match.homeTeamId ?? null, match.awayTeamId ?? null, match.homeSlot, match.awaySlot);
  createPlayer('Demo Player', 'FRIENDS2026');
  createPlayer('Admin', 'ADMIN2026', 'admin');
}

export function createPlayer(name: string, inviteCode: string, role = 'player') {
  const id = slug(`${name}-${role}`);
  const now = new Date().toISOString();
  db.prepare('INSERT OR IGNORE INTO users VALUES (?, ?, ?, ?, ?)').run(id, name, inviteCode, role, now);
  db.prepare('INSERT OR IGNORE INTO players VALUES (?, ?, ?, ?)').run(id, id, name, now);
  return { id, name, role };
}

export function getState(playerId?: string) {
  return {
    competition: one('SELECT * FROM competitions WHERE id = ?', ['wc2026']),
    teams: all('SELECT * FROM teams ORDER BY id'),
    groups: all('SELECT * FROM groups ORDER BY id'),
    matches: all('SELECT * FROM matches ORDER BY id'),
    predictions: playerId ? all('SELECT * FROM predictions WHERE player_id = ? ORDER BY match_id', [playerId]) : [],
    bonusPrediction: playerId ? one('SELECT * FROM bonus_predictions WHERE player_id = ?', [playerId]) : null,
    results: all('SELECT * FROM actual_results ORDER BY match_id'),
    leaderboard: getLeaderboard(),
    lastUpdated: new Date().toISOString()
  };
}

export function savePredictions(playerId: string, predictions: MatchPrediction[]) {
  assertUnlocked();
  const now = new Date().toISOString();
  const insert = db.prepare('INSERT OR REPLACE INTO predictions VALUES (?, ?, ?, ?, ?, ?)');
  for (const prediction of predictions) insert.run(playerId, prediction.matchId, prediction.homeGoals, prediction.awayGoals, prediction.penaltyWinner ?? null, now);
  db.prepare('INSERT OR REPLACE INTO prediction_submissions VALUES (?, ?)').run(playerId, now);
  recalculateScores();
}

export function saveBonusPrediction(playerId: string, groups: GroupBonusPrediction[], knockout: KnockoutBonusPrediction) {
  assertUnlocked();
  db.prepare('INSERT OR REPLACE INTO bonus_predictions VALUES (?, ?, ?, ?)').run(playerId, JSON.stringify(groups), JSON.stringify(knockout), new Date().toISOString());
  recalculateScores();
}

export function saveResult(actor: string, result: MatchResult) {
  db.prepare('INSERT OR REPLACE INTO actual_results VALUES (?, ?, ?, ?, ?)').run(result.matchId, result.homeGoals, result.awayGoals, result.penaltyWinner ?? null, new Date().toISOString());
  audit(actor, 'result.updated', result);
  recalculateScores();
}

export function setLock(actor: string, locked: boolean) {
  db.prepare('UPDATE competitions SET predictions_locked = ?, updated_at = ? WHERE id = ?').run(locked ? 1 : 0, new Date().toISOString(), 'wc2026');
  audit(actor, locked ? 'deadline.locked' : 'deadline.unlocked', { locked });
}

export function saveBonusResults(actor: string, groups: GroupBonusPrediction[], knockout: KnockoutBonusPrediction & { topScorers?: string[] }) {
  const payload = { ...knockout, topScorers: knockout.topScorers?.length ? knockout.topScorers : [knockout.topScorer] };
  db.prepare('INSERT OR REPLACE INTO bonus_results VALUES (?, ?, ?, ?)').run('wc2026', JSON.stringify(groups), JSON.stringify(payload), new Date().toISOString());
  audit(actor, 'bonus-results.updated', { groups, knockout: payload });
  recalculateScores();
}

export function recalculateScores() {
  db.exec('DELETE FROM score_breakdowns');
  const results = new Map(all('SELECT * FROM actual_results').map((row) => [Number(row.match_id), row]));
  const bonusResultRow = one('SELECT * FROM bonus_results WHERE competition_id = ?', ['wc2026']);
  const groupResults: GroupBonusPrediction[] = bonusResultRow ? JSON.parse(String(bonusResultRow.group_json)) : [];
  const knockoutResult = bonusResultRow ? JSON.parse(String(bonusResultRow.knockout_json)) : null;
  for (const player of all('SELECT id FROM players')) {
    for (const prediction of all('SELECT * FROM predictions WHERE player_id = ?', [String(player.id)])) {
      const actual = results.get(Number(prediction.match_id));
      if (actual) {
        const scored = scoreMatch(toPrediction(prediction), toResult(actual));
        storeBreakdown(String(player.id), 'match', String(scored.matchId), scored.points, scored.explanation);
      }
    }
    const bonusPrediction = one('SELECT * FROM bonus_predictions WHERE player_id = ?', [String(player.id)]);
    if (bonusPrediction && bonusResultRow && knockoutResult) {
      const predictedGroups: GroupBonusPrediction[] = JSON.parse(String(bonusPrediction.group_json));
      for (const actualGroup of groupResults) {
        const predictedGroup = predictedGroups.find((group) => group.groupId === actualGroup.groupId);
        if (predictedGroup) for (const item of scoreGroupBonus(predictedGroup, actualGroup)) storeBreakdown(String(player.id), 'bonus', item.code, item.points, item.explanation);
      }
      const predictedKnockout: KnockoutBonusPrediction = JSON.parse(String(bonusPrediction.knockout_json));
      for (const item of scoreKnockoutBonus(predictedKnockout, knockoutResult)) storeBreakdown(String(player.id), 'bonus', item.code, item.points, item.explanation);
    }
  }
  const snapshot = getLeaderboard();
  db.prepare('INSERT INTO leaderboard_snapshots (created_at, snapshot_json) VALUES (?, ?)').run(new Date().toISOString(), JSON.stringify(snapshot));
  return snapshot;
}

export function getLeaderboard(): ParticipantScore[] {
  const previous = one('SELECT snapshot_json FROM leaderboard_snapshots ORDER BY id DESC LIMIT 1');
  const previousRanks = new Map<string, number>();
  if (previous) JSON.parse(String(previous.snapshot_json)).forEach((score: ParticipantScore, index: number) => previousRanks.set(score.playerId, index + 1));
  const scores = all('SELECT players.id, players.display_name, COALESCE(prediction_submissions.submitted_at, players.created_at) AS submitted_at FROM players LEFT JOIN prediction_submissions ON prediction_submissions.player_id = players.id').map((player) => {
    const rows = all('SELECT item_type, points FROM score_breakdowns WHERE player_id = ?', [String(player.id)]);
    const matchPoints = sumPoints(rows.filter((row) => row.item_type === 'match').map((row) => ({ points: Number(row.points) })));
    const bonusPoints = sumPoints(rows.filter((row) => row.item_type === 'bonus').map((row) => ({ points: Number(row.points) })));
    return { playerId: String(player.id), name: String(player.display_name), submittedAt: String(player.submitted_at), matchPoints, bonusPoints, totalPoints: matchPoints + bonusPoints, previousRank: previousRanks.get(String(player.id)) };
  });
  return rankParticipants(scores);
}

export function breakdownFor(playerId: string) {
  return all('SELECT * FROM score_breakdowns WHERE player_id = ? ORDER BY item_type, item_id', [playerId]);
}

function assertUnlocked() {
  if (one('SELECT predictions_locked FROM competitions WHERE id = ?', ['wc2026'])?.predictions_locked === 1) throw new Error('Predictions are locked');
}

function audit(actor: string, action: string, payload: unknown) {
  db.prepare('INSERT INTO admin_audit_log (actor, action, payload_json, created_at) VALUES (?, ?, ?, ?)').run(actor, action, JSON.stringify(payload), new Date().toISOString());
}

function storeBreakdown(playerId: string, itemType: string, itemId: string, points: number, explanation: string) {
  db.prepare('INSERT OR REPLACE INTO score_breakdowns VALUES (?, ?, ?, ?, ?)').run(playerId, itemType, itemId, points, explanation);
}

function toPrediction(row: Record<string, unknown>): MatchPrediction {
  return { matchId: Number(row.match_id), homeGoals: Number(row.home_goals), awayGoals: Number(row.away_goals), penaltyWinner: row.penalty_winner as MatchPrediction['penaltyWinner'] };
}

function toResult(row: Record<string, unknown>): MatchResult {
  return { matchId: Number(row.match_id), homeGoals: Number(row.home_goals), awayGoals: Number(row.away_goals), penaltyWinner: row.penalty_winner as MatchResult['penaltyWinner'] };
}

function all(sql: string, values: SQLInputValue[] = []): Record<string, unknown>[] {
  return db.prepare(sql).all(...values) as Record<string, unknown>[];
}

function one(sql: string, values: SQLInputValue[] = []): Record<string, unknown> | null {
  return (db.prepare(sql).get(...values) as Record<string, unknown> | undefined) ?? null;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
