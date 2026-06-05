import { randomUUID } from 'node:crypto';
import type { LeaderboardEntry } from '../../domain/predictionRepository.js';
import type { QueryableDatabase, QueryValue } from '../databaseAdapter.js';
import { findNextSuggestedRunAt, planMatchUpdates } from './matchScheduler.js';
import type { LeaderboardMetadata, LeaderboardRepository } from './leaderboardRepository.js';
import { migrateResultPersistenceSchema } from './resultPersistenceSchema.js';
import type { LeaderboardRebuildResult, MatchStatus, ResultAgentRunSummary, ResultAgentStatus, ResultUpdate, ResultsAgentRepository, TrackedMatch } from './resultTypes.js';

export class DatabaseResultRepository implements ResultsAgentRepository, LeaderboardRepository {
  constructor(private readonly db: QueryableDatabase) {}

  async migrate(): Promise<void> {
    await migrateResultPersistenceSchema(this.db);
  }

  async getMatchResult(matchId: number): Promise<ResultUpdate | undefined> {
    await this.migrate();
    const row = await this.db.one('SELECT * FROM match_results WHERE match_id = ?', [matchId]);
    return row ? toResultUpdate(row) : undefined;
  }

  async getAllMatchResults(): Promise<ResultUpdate[]> {
    await this.migrate();
    const rows = await this.db.all('SELECT * FROM match_results ORDER BY match_id');
    return rows.map(toResultUpdate);
  }

  async listTrackedMatches(): Promise<TrackedMatch[]> {
    await this.migrate();
    const rows = await this.db.all(`
      SELECT
        m.id,
        m.kickoff_at,
        COALESCE(t_home.name_et, t_home.name, m.home_slot) AS home_team,
        COALESCE(t_away.name_et, t_away.name, m.away_slot) AS away_team,
        r.provider_fixture_id,
        r.status,
        r.home_score,
        r.away_score,
        r.minute,
        r.is_final,
        r.last_checked_at,
        r.next_check_at
      FROM matches m
      LEFT JOIN match_results r ON r.match_id = m.id
      LEFT JOIN teams t_home ON t_home.id = m.home_team_id
      LEFT JOIN teams t_away ON t_away.id = m.away_team_id
      ORDER BY m.id
    `);
    return rows.flatMap((row) => {
      const kickoffUtc = String(row.kickoff_at);
      if (Number.isNaN(Date.parse(kickoffUtc))) return [];
      return [{
        id: Number(row.id),
        providerMatchId: nullableString(row.provider_fixture_id),
        kickoffUtc,
        status: row.status ? (String(row.status) as MatchStatus) : 'SCHEDULED',
        homeTeam: String(row.home_team),
        awayTeam: String(row.away_team),
        homeScore: nullableNumber(row.home_score),
        awayScore: nullableNumber(row.away_score),
        minute: nullableNumber(row.minute),
        isFinal: toBoolean(row.is_final),
        lastCheckedAt: nullableString(row.last_checked_at),
        nextCheckAt: nullableString(row.next_check_at)
      }];
    });
  }

  async saveResultUpdate(update: ResultUpdate): Promise<{ finalResultChanged: boolean }> {
    await this.migrate();
    const previous = await this.getMatchResult(update.matchId);
    const updatedAt = update.lastCheckedAt;
    await this.db.transaction(async (tx) => {
      await upsert(
        tx,
        'match_results',
        [
          'match_id',
          'home_score',
          'away_score',
          'minute',
          'status',
          'is_final',
          'provider',
          'provider_fixture_id',
          'raw_provider_status',
          'last_checked_at',
          'next_check_at',
          'updated_at',
          'points_recalculated_at'
        ],
        [
          update.matchId,
          update.homeScore ?? null,
          update.awayScore ?? null,
          update.minute ?? null,
          update.status,
          update.isFinal ? 1 : 0,
          update.provider,
          update.providerMatchId ?? null,
          update.rawProviderStatus ?? null,
          update.lastCheckedAt,
          update.nextCheckAt ?? null,
          updatedAt,
          null
        ],
        ['match_id']
      );
      await tx.run(
        `INSERT INTO result_updates (
          id, match_id, source, status, home_score, away_score, minute, is_final, last_checked_at, next_check_at,
          points_recalculated_at, provider_fixture_id, provider_updated_at, raw_provider_status, warning, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `result-update-${randomUUID()}`,
          update.matchId,
          update.provider,
          update.status,
          update.homeScore ?? null,
          update.awayScore ?? null,
          update.minute ?? null,
          update.isFinal ? 1 : 0,
          update.lastCheckedAt,
          update.nextCheckAt ?? null,
          null,
          update.providerMatchId ?? null,
          update.providerUpdatedAt ?? null,
          update.rawProviderStatus ?? null,
          update.warning ?? null,
          null
        ]
      );
    });

    return {
      finalResultChanged:
        update.isFinal &&
        (!previous ||
          previous.homeScore !== update.homeScore ||
          previous.awayScore !== update.awayScore ||
          previous.status !== update.status)
    };
  }

  async getFinalizedResults(): Promise<ResultUpdate[]> {
    return (await this.getAllMatchResults()).filter((result) => result.isFinal);
  }

  async getStatus(provider: string, now: Date): Promise<ResultAgentStatus> {
    const plans = planMatchUpdates(await this.listTrackedMatches(), now);
    const metadata = await this.getLeaderboardMetadata();
    const latestRun = await this.db.one('SELECT finished_at FROM result_agent_runs ORDER BY finished_at DESC LIMIT 1').catch(() => null);
    return {
      lastRunAt: nullableString(latestRun?.finished_at),
      nextSuggestedRunAt: findNextSuggestedRunAt(plans),
      staleMatchesCount: plans.filter((plan) => plan.shouldCheckNow).length,
      provider,
      mode: provider === 'mock-result-provider' ? 'mock' : 'live',
      lastLeaderboardRebuildAt: metadata.lastRebuildAt
    };
  }

  async markPointsRecalculated(matchId: number, timestamp: string): Promise<void> {
    await this.migrate();
    await this.db.run('UPDATE match_results SET points_recalculated_at = ?, updated_at = ? WHERE match_id = ?', [timestamp, timestamp, matchId]);
  }

  async saveRunSummary(summary: ResultAgentRunSummary): Promise<void> {
    await this.migrate();
    await this.db.exec(`
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
    await this.db.run(
      `INSERT INTO result_agent_runs (
        id, started_at, finished_at, checked_matches, updated_matches, finalized_matches,
        leaderboard_rebuilt, players_processed, warnings_json, provider, mode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `result-agent-run-${randomUUID()}`,
        summary.startedAt,
        summary.finishedAt,
        summary.checkedMatches,
        summary.updatedMatches,
        summary.finalizedMatches,
        summary.leaderboardRebuilt ? 1 : 0,
        summary.playersProcessed,
        JSON.stringify(summary.warnings),
        summary.provider,
        summary.mode
      ]
    );
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    await this.migrate();
    const rows = await this.db.all('SELECT * FROM leaderboard_entries ORDER BY rank, player_id');
    return rows.map(toLeaderboardEntry);
  }

  async replaceLeaderboard(entries: LeaderboardEntry[], metadata: LeaderboardRebuildResult): Promise<void> {
    await this.migrate();
    await this.db.transaction(async (tx) => {
      await tx.run('DELETE FROM leaderboard_entries');
      for (const entry of entries) {
        await tx.run(
          `INSERT INTO leaderboard_entries (
            player_id, rank, points, exact_scores, correct_results, hit_rate, matches_scored, match_points,
            group_bonus_points, playoff_bonus_points, top_scorer_bonus_points, total_points, previous_rank, last_updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
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
          ]
        );
      }
      await upsert(
        tx,
        'leaderboard_metadata',
        ['id', 'last_rebuild_at', 'players_processed', 'matches_processed', 'changed_entries', 'warnings_json'],
        ['current', metadata.recalculatedAt, metadata.playersProcessed, metadata.matchesProcessed, metadata.changedEntries, JSON.stringify(metadata.warnings)],
        ['id']
      );
    });
  }

  async getLeaderboardMetadata(): Promise<LeaderboardMetadata> {
    await this.migrate();
    const row = await this.db.one('SELECT * FROM leaderboard_metadata WHERE id = ?', ['current']);
    if (!row) return { playersProcessed: 0, matchesProcessed: 0, changedEntries: 0, warnings: [] };
    return {
      lastRebuildAt: nullableString(row.last_rebuild_at),
      playersProcessed: Number(row.players_processed ?? 0),
      matchesProcessed: Number(row.matches_processed ?? 0),
      changedEntries: Number(row.changed_entries ?? 0),
      warnings: parseWarnings(row.warnings_json)
    };
  }
}

async function upsert(db: QueryableDatabase, table: string, columns: string[], values: QueryValue[], conflictColumns: string[]): Promise<void> {
  if (db.provider === 'postgres') {
    const updateColumns = columns.filter((column) => !conflictColumns.includes(column));
    await db.run(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})
      ON CONFLICT (${conflictColumns.join(', ')}) DO UPDATE SET ${updateColumns.map((column) => `${column} = EXCLUDED.${column}`).join(', ')}`, values);
  } else {
    await db.run(`INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, values);
  }
}

function toResultUpdate(row: Record<string, unknown>): ResultUpdate {
  return {
    matchId: Number(row.match_id),
    providerMatchId: nullableString(row.provider_fixture_id),
    status: String(row.status) as MatchStatus,
    homeScore: nullableNumber(row.home_score),
    awayScore: nullableNumber(row.away_score),
    minute: nullableNumber(row.minute),
    isFinal: toBoolean(row.is_final),
    lastCheckedAt: nullableString(row.last_checked_at) ?? String(row.updated_at),
    nextCheckAt: nullableString(row.next_check_at),
    provider: nullableString(row.provider) ?? 'unknown',
    rawProviderStatus: nullableString(row.raw_provider_status),
    pointsRecalculatedAt: nullableString(row.points_recalculated_at)
  };
}

function toLeaderboardEntry(row: Record<string, unknown>): LeaderboardEntry {
  return {
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
    previousRank: nullableNumber(row.previous_rank),
    lastUpdatedAt: String(row.last_updated_at)
  };
}

function nullableString(value: unknown): string | undefined {
  return value === null || value === undefined ? undefined : String(value);
}

function nullableNumber(value: unknown): number | undefined {
  return value === null || value === undefined ? undefined : Number(value);
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

function parseWarnings(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}
