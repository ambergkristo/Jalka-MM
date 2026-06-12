import { randomUUID } from 'node:crypto';
import type { QueryableDatabase } from '../databaseAdapter.js';
import { migrateResultPersistenceSchema } from './resultPersistenceSchema.js';
import type { ResultScorer } from './resultTypes.js';

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
      const team = await resolveTeam(tx, scorer);
      const id = `${matchId}-${randomUUID()}`;
      await tx.run(
        `INSERT INTO result_manual_scorers (id, match_id, player_name, team_id, team_code, goals, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, matchId, scorer.playerName, team.teamId ?? null, team.teamCode ?? scorer.teamCode ?? null, scorer.goals, nowIso]
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
    SELECT player_name, team_id, SUM(goals) AS goals
    FROM result_manual_scorers
    GROUP BY player_name, team_id
    ORDER BY goals DESC, player_name ASC, team_id ASC
  `);
  await db.run('DELETE FROM top_scorer_standings');
  for (const [index, row] of rows.entries()) {
    const playerName = String(row.player_name);
    const teamId = row.team_id === null || row.team_id === undefined || row.team_id === '' ? null : String(row.team_id);
    const goals = Number(row.goals ?? 0);
    await db.run(
      `INSERT INTO top_scorer_standings (id, rank, player_name, team_id, goals, assists, minutes_played, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [`${index + 1}-${slug(playerName)}-${teamId ?? 'unknown'}`, index + 1, playerName, teamId, goals, 0, null, nowIso]
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
     WHERE (? IS NOT NULL AND code = ?)
        OR (? IS NOT NULL AND id = ?)
        OR (? IS NOT NULL AND name = ?)
        OR (? IS NOT NULL AND name_et = ?)
     LIMIT 1`,
    [code ?? null, code ?? null, code ?? null, code ?? null, name ?? null, name ?? null, name ?? null, name ?? null]
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
