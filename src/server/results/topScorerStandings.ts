import { randomUUID } from 'node:crypto';
import type { QueryableDatabase } from '../databaseAdapter.js';
import { normalizeScorerName } from './scorerNormalization.js';
import { migrateResultPersistenceSchema } from './resultPersistenceSchema.js';
import type { ResultScorer } from './resultTypes.js';

export async function backfillTopScorersFromConfirmedResults(db: QueryableDatabase, nowIso: string): Promise<{ repaired: boolean; reason: string; repairedMatches: number }> {
  await migrateResultPersistenceSchema(db);
  const confirmedResults = await db.all(`
    SELECT match_id, provider_results_json
    FROM match_results
    WHERE public_status = 'CONFIRMED_FINAL' AND is_final = 1 AND provider_results_json IS NOT NULL
    ORDER BY match_id
  `);
  if (confirmedResults.length === 0) {
    return { repaired: false, reason: 'no-confirmed-results', repairedMatches: 0 };
  }

  let repairedMatches = 0;
  for (const result of confirmedResults) {
    const scorers = parseProviderScorers(result.provider_results_json);
    if (scorers.length === 0) continue;
    await syncConfirmedScorersForMatch(db, Number(result.match_id), scorers, nowIso);
    repairedMatches += 1;
  }

  return {
    repaired: repairedMatches > 0,
    reason: repairedMatches > 0 ? 'backfilled-from-stored-provider-results' : 'no-provider-scorers-found',
    repairedMatches
  };
}

export async function syncConfirmedScorersForMatch(
  db: QueryableDatabase,
  matchId: number,
  scorers: ResultScorer[],
  nowIso: string
): Promise<void> {
  await migrateResultPersistenceSchema(db);
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM result_manual_scorers WHERE match_id = ?', [matchId]);
    for (const [index, scorer] of scorers.entries()) {
      const playerName = normalizeScorerName(scorer.playerName);
      if (!playerName) continue;
      const team = await resolveTeam(tx, scorer);
      const id = `${matchId}-${randomUUID()}`;
      await tx.run(
        `INSERT INTO result_manual_scorers (id, match_id, player_name, team_id, team_code, goals, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, matchId, playerName, team.teamId ?? null, team.teamCode ?? scorer.teamCode ?? null, scorer.goals, nowIso]
      );
    }
    await rebuildTopScorerStandingsInTransaction(tx, nowIso);
  });
}

export async function rebuildTopScorerStandings(db: QueryableDatabase, nowIso: string): Promise<void> {
  await migrateResultPersistenceSchema(db);
  await db.transaction(async (tx) => {
    await rebuildTopScorerStandingsInTransaction(tx, nowIso);
  });
}

async function rebuildTopScorerStandingsInTransaction(db: QueryableDatabase, nowIso: string): Promise<void> {
  const rows = await db.all(`
    SELECT player_name, team_id, team_code, goals
    FROM result_manual_scorers
    ORDER BY match_id, created_at, player_name
  `);
  const grouped = new Map<string, { playerName: string; teamId: string | null; goals: number }>();
  for (const row of rows) {
    const playerName = normalizeScorerName(String(row.player_name ?? ''));
    if (!playerName) continue;
    const goals = Number(row.goals ?? 0);
    if (!Number.isFinite(goals) || goals <= 0) continue;
    const teamId = row.team_id === null || row.team_id === undefined || row.team_id === '' ? null : String(row.team_id);
    const teamCode = row.team_code === null || row.team_code === undefined || row.team_code === '' ? null : String(row.team_code);
    const key = `${playerName}|${teamId ?? teamCode ?? ''}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.goals += goals;
    } else {
      grouped.set(key, { playerName, teamId, goals });
    }
  }
  const aggregatedRows = [...grouped.values()].sort((a, b) =>
    b.goals - a.goals ||
    a.playerName.localeCompare(b.playerName, 'et') ||
    String(a.teamId ?? '').localeCompare(String(b.teamId ?? ''), 'et')
  );
  await db.run('DELETE FROM top_scorer_standings');
  for (const [index, row] of aggregatedRows.entries()) {
    await db.run(
      `INSERT INTO top_scorer_standings (id, rank, player_name, team_id, goals, assists, minutes_played, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [`${index + 1}-${slug(row.playerName)}-${row.teamId ?? 'unknown'}`, index + 1, row.playerName, row.teamId, row.goals, 0, null, nowIso]
    );
  }
}

async function resolveTeam(
  db: QueryableDatabase,
  scorer: ResultScorer
): Promise<{ teamId?: string; teamCode?: string }> {
  const code = scorer.teamCode?.trim();
  const name = scorer.teamName?.trim();
  if (!code && !name) return {};
  const row = await db.one(
    `SELECT id, code FROM teams
     WHERE code = ?
        OR id = ?
        OR name = ?
        OR name_et = ?
     LIMIT 1`,
    [code ?? null, code ?? null, name ?? null, name ?? null]
  );
  if (!row) return { teamCode: code };
  const team: { teamId?: string; teamCode?: string } = {};
  if (row.id !== undefined && row.id !== null && String(row.id)) team.teamId = String(row.id);
  if (row.code !== undefined && row.code !== null && String(row.code)) team.teamCode = String(row.code);
  else if (code) team.teamCode = code;
  return team;
}

function slug(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseProviderScorers(value: unknown): ResultScorer[] {
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    const observations = parsed
      .map((item) => extractObservationScorers(item))
      .filter((scorers) => scorers.length > 0);
    return observations.at(-1) ?? [];
  } catch {
    return [];
  }
}

function extractObservationScorers(value: unknown): ResultScorer[] {
  if (!value || typeof value !== 'object') return [];
  const observation = value as Record<string, unknown>;
  const scorers = observation.scorers;
  if (!Array.isArray(scorers)) return [];
  return scorers.flatMap((scorer) => normalizeScorer(scorer));
}

function normalizeScorer(value: unknown): ResultScorer[] {
  if (!value || typeof value !== 'object') return [];
  const scorer = value as Record<string, unknown>;
  const rawPlayerName = scorer.playerName ?? scorer.player_name ?? scorer.player ?? scorer.name;
  const playerName = typeof rawPlayerName === 'string' ? normalizeScorerName(rawPlayerName) : '';
  const rawTeamName = scorer.teamName ?? scorer.team_name ?? scorer.team ?? scorer.country;
  const teamName = typeof rawTeamName === 'string' ? rawTeamName.trim() : undefined;
  const rawTeamCode = scorer.teamCode ?? scorer.team_code ?? scorer.code;
  const teamCode = typeof rawTeamCode === 'string' ? rawTeamCode.trim() : undefined;
  const goals = Number(scorer.goals ?? 1);
  if (!playerName || !Number.isInteger(goals) || goals <= 0) return [];
  if (!teamName && !teamCode) return [];
  return [{ playerName, teamName: teamName || undefined, teamCode: teamCode || undefined, goals }];
}
