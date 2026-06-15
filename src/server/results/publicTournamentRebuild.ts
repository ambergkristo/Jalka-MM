import type { LeaderboardEntry } from '../../domain/predictionRepository.js';
import { rebuildLeaderboardAfterFinalResult } from './leaderboardRebuild.js';
import { backfillTopScorersFromConfirmedResults, rebuildTopScorerStandings } from './topScorerStandings.js';
import type { LeaderboardRebuildResult, ResultUpdate } from './resultTypes.js';
import type { QueryableDatabase } from '../databaseAdapter.js';
import { migrateResultPersistenceSchema } from './resultPersistenceSchema.js';

export interface PublicTournamentStateRefreshResult {
  leaderboardRebuild?: LeaderboardRebuildResult;
  scorerRepair: { repaired: boolean; reason: string; repairedMatches: number };
  publicSnapshotRebuiltAt: string;
  groupStandingsRowsCount: number;
  leaderboardRowsCount: number;
  topScorerRowsCount: number;
}

export async function rebuildPublicTournamentState(db: QueryableDatabase, now: Date): Promise<PublicTournamentStateRefreshResult> {
  await migrateResultPersistenceSchema(db);
  const nowIso = now.toISOString();
  const finalizedResults = await readFinalizedResults(db, nowIso);
  if (finalizedResults.length === 0) {
    await writePublicSnapshotRebuildAt(db, nowIso);
    return {
      scorerRepair: { repaired: false, reason: 'no-confirmed-results', repairedMatches: 0 },
      publicSnapshotRebuiltAt: nowIso,
      groupStandingsRowsCount: await countRows(db, 'group_standings'),
      leaderboardRowsCount: await countRows(db, 'leaderboard_entries'),
      topScorerRowsCount: await countRows(db, 'top_scorer_standings')
    };
  }

  const previousEntries = await readLeaderboardEntries(db);
  const scorerRepair = await backfillTopScorersFromConfirmedResults(db, nowIso);
  await rebuildTopScorerStandings(db, nowIso);
  const groupStandingsRowsCount = await rebuildGroupStandingsCache(db, now);
  const leaderboardRebuild = await rebuildLeaderboardAfterFinalResult({
    finalizedResults,
    now,
    previousEntries
  });
  await writeLeaderboardEntries(db, leaderboardRebuild.entries);
  await writeLeaderboardMetadata(db, leaderboardRebuild);
  await markConfirmedResultsRecalculated(db, nowIso);
  await writePublicSnapshotRebuildAt(db, nowIso);

  return {
    leaderboardRebuild,
    scorerRepair,
    publicSnapshotRebuiltAt: nowIso,
    groupStandingsRowsCount,
    leaderboardRowsCount: leaderboardRebuild.entries.length,
    topScorerRowsCount: await countRows(db, 'top_scorer_standings')
  };
}

async function readFinalizedResults(db: QueryableDatabase, nowIso: string): Promise<ResultUpdate[]> {
  const rows = await db.all(`
    SELECT match_id, confirmed_home_score, confirmed_away_score, is_final
    FROM match_results
    WHERE public_status = 'CONFIRMED_FINAL' AND is_final = 1
    ORDER BY match_id
  `);
  return rows.flatMap((row) => {
    const homeScore = toNumber(row.confirmed_home_score);
    const awayScore = toNumber(row.confirmed_away_score);
    if (homeScore === undefined || awayScore === undefined) return [];
    return [{
      matchId: Number(row.match_id),
      status: 'FINISHED',
      homeScore,
      awayScore,
      isFinal: Number(row.is_final ?? 0) === 1,
      lastCheckedAt: nowIso,
      provider: 'system'
    }];
  });
}

async function readLeaderboardEntries(db: QueryableDatabase): Promise<LeaderboardEntry[]> {
  const rows = await db.all('SELECT * FROM leaderboard_entries ORDER BY rank, player_id');
  return rows.map((row) => ({
    playerId: String(row.player_id),
    rank: Number(row.rank),
    points: Number(row.points),
    exactScores: Number(row.exact_scores),
    correctResults: Number(row.correct_results),
    hitRate: Number(row.hit_rate),
    matchesScored: Number(row.matches_scored ?? 0),
    matchPoints: Number(row.match_points ?? row.points ?? 0),
    groupBonusPoints: Number(row.group_bonus_points ?? 0),
    playoffBonusPoints: Number(row.playoff_bonus_points ?? 0),
    topScorerBonusPoints: Number(row.top_scorer_bonus_points ?? 0),
    totalPoints: Number(row.total_points ?? row.points ?? 0),
    previousRank: row.previous_rank === null || row.previous_rank === undefined ? undefined : Number(row.previous_rank),
    lastUpdatedAt: String(row.last_updated_at)
  }));
}

async function writeLeaderboardEntries(db: QueryableDatabase, entries: LeaderboardEntry[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const entry of entries) {
      await upsertLeaderboardEntry(tx, entry);
    }
    await deleteLeaderboardRowsNotIn(tx, entries.map((entry) => entry.playerId));
  });
}

async function upsertLeaderboardEntry(db: QueryableDatabase, entry: LeaderboardEntry): Promise<void> {
  const columns = [
    'player_id',
    'rank',
    'points',
    'exact_scores',
    'correct_results',
    'hit_rate',
    'matches_scored',
    'match_points',
    'group_bonus_points',
    'playoff_bonus_points',
    'top_scorer_bonus_points',
    'total_points',
    'previous_rank',
    'last_updated_at'
  ];
  const values = [
    entry.playerId,
    entry.rank,
    entry.points,
    entry.exactScores,
    entry.correctResults,
    entry.hitRate,
    entry.matchesScored ?? 0,
    entry.matchPoints ?? entry.points,
    entry.groupBonusPoints ?? 0,
    entry.playoffBonusPoints ?? 0,
    entry.topScorerBonusPoints ?? 0,
    entry.totalPoints ?? entry.points,
    entry.previousRank ?? null,
    entry.lastUpdatedAt
  ];
  if (db.provider === 'postgres') {
    const updateColumns = columns.filter((column) => column !== 'player_id');
    await db.run(`INSERT INTO leaderboard_entries (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})
      ON CONFLICT (player_id) DO UPDATE SET ${updateColumns.map((column) => `${column} = EXCLUDED.${column}`).join(', ')}`, values);
  } else {
    await db.run(`INSERT OR REPLACE INTO leaderboard_entries (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, values);
  }
}

async function deleteLeaderboardRowsNotIn(db: QueryableDatabase, playerIds: string[]): Promise<void> {
  if (playerIds.length === 0) {
    await db.run('DELETE FROM leaderboard_entries');
    return;
  }
  await db.run(`DELETE FROM leaderboard_entries WHERE player_id NOT IN (${playerIds.map(() => '?').join(', ')})`, playerIds);
}

async function writeLeaderboardMetadata(db: QueryableDatabase, metadata: LeaderboardRebuildResult): Promise<void> {
  await db.run(
    `INSERT INTO leaderboard_metadata (
      id, last_rebuild_at, players_processed, matches_processed, changed_entries, warnings_json
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      last_rebuild_at = excluded.last_rebuild_at,
      players_processed = excluded.players_processed,
      matches_processed = excluded.matches_processed,
      changed_entries = excluded.changed_entries,
      warnings_json = excluded.warnings_json`,
    ['current', metadata.recalculatedAt, metadata.playersProcessed, metadata.matchesProcessed, metadata.changedEntries, JSON.stringify(metadata.warnings)]
  );
}

async function rebuildGroupStandingsCache(db: QueryableDatabase, now: Date): Promise<number> {
  const teams = await db.all('SELECT id, name, group_id FROM teams WHERE group_id IS NOT NULL ORDER BY group_id, id');
  const standings = new Map<string, {
    groupId: string;
    teamId: string;
    teamName: string;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    points: number;
  }>();
  for (const team of teams) {
    const groupId = String(team.group_id);
    const teamId = String(team.id);
    standings.set(teamId, {
      groupId,
      teamId,
      teamName: String(team.name),
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0
    });
  }

  const results = await db.all(`
    SELECT m.home_team_id, m.away_team_id, r.confirmed_home_score, r.confirmed_away_score
    FROM match_results r
    JOIN matches m ON m.id = r.match_id
    WHERE r.public_status = 'CONFIRMED_FINAL' AND r.is_final = 1 AND m.stage = 'GROUP'
  `);

  for (const result of results) {
    const home = standings.get(String(result.home_team_id));
    const away = standings.get(String(result.away_team_id));
    if (!home || !away) continue;
    applyResult(home, Number(result.confirmed_home_score), Number(result.confirmed_away_score));
    applyResult(away, Number(result.confirmed_away_score), Number(result.confirmed_home_score));
  }

  const groups = [...new Set([...standings.values()].map((row) => row.groupId))].sort();
  const rows: Array<[string, string, number, number, number, number, number, number, number, number, number, string]> = [];
  for (const group of groups) {
    const sorted = [...standings.values()]
      .filter((row) => row.groupId === group)
      .sort((a, b) =>
        b.points - a.points ||
        goalDifference(b) - goalDifference(a) ||
        b.goalsFor - a.goalsFor ||
        a.teamName.localeCompare(b.teamName)
      );
    for (const [index, row] of sorted.entries()) {
      rows.push([
        group,
        row.teamId,
        index + 1,
        row.played,
        row.wins,
        row.draws,
        row.losses,
        row.goalsFor,
        row.goalsAgainst,
        goalDifference(row),
        row.points,
        now.toISOString()
      ]);
    }
  }

  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM group_standings');
    for (const row of rows) {
      await tx.run(
        `INSERT INTO group_standings (
          group_id, team_id, rank, played, wins, draws, losses, goals_for, goals_against, goal_difference, points, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row
      );
    }
  });
  return rows.length;
}

async function markConfirmedResultsRecalculated(db: QueryableDatabase, timestamp: string): Promise<void> {
  await db.run(
    `UPDATE match_results
     SET points_recalculated_at = ?, updated_at = ?
     WHERE public_status = 'CONFIRMED_FINAL' AND is_final = 1`,
    [timestamp, timestamp]
  );
}

async function writePublicSnapshotRebuildAt(db: QueryableDatabase, timestamp: string): Promise<void> {
  await db.run(
    `INSERT INTO public_state_metadata (id, last_public_snapshot_rebuild_at)
     VALUES ('public-state', ?)
     ON CONFLICT(id) DO UPDATE SET last_public_snapshot_rebuild_at = excluded.last_public_snapshot_rebuild_at`,
    [timestamp]
  );
}

async function countRows(db: QueryableDatabase, table: string): Promise<number> {
  return Number((await db.one(`SELECT COUNT(*) AS count FROM ${table}`))?.count ?? 0);
}

function applyResult(row: {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}, goalsFor: number, goalsAgainst: number): void {
  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  if (goalsFor > goalsAgainst) {
    row.wins += 1;
    row.points += 3;
  } else if (goalsFor === goalsAgainst) {
    row.draws += 1;
    row.points += 1;
  } else {
    row.losses += 1;
  }
}

function goalDifference(row: { goalsFor: number; goalsAgainst: number }): number {
  return row.goalsFor - row.goalsAgainst;
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
