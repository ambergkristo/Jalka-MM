import { randomUUID } from 'node:crypto';
import type { LeaderboardEntry } from '../../domain/predictionRepository.js';
import type { QueryableDatabase, QueryValue } from '../databaseAdapter.js';
import { findNextSuggestedRunAt, planMatchUpdates } from './matchScheduler.js';
import type { LeaderboardMetadata, LeaderboardRepository } from './leaderboardRepository.js';
import { migrateResultPersistenceSchema } from './resultPersistenceSchema.js';
import { rebuildPublicTournamentState } from './publicTournamentRebuild.js';
import { syncConfirmedScorersForMatch } from './topScorerStandings.js';
import { CONFIRMED_FINAL_RESULT_SQL } from './finalizedResultState.js';
import type { LeaderboardRebuildResult, MatchStatus, ProviderResultObservation, PublicResultStatus, ResultAgentRunSummary, ResultAgentStatus, ResultAgentWarningDetail, ResultUpdate, ResultsAgentRepository, TrackedMatch } from './resultTypes.js';

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
        m.stage,
        m.kickoff_at,
        COALESCE(t_home.name_et, t_home.name, m.home_slot) AS home_team,
        COALESCE(t_away.name_et, t_away.name, m.away_slot) AS away_team,
        r.provider_fixture_id,
        r.status,
        COALESCE(r.confirmed_home_score, r.home_score) AS home_score,
        COALESCE(r.confirmed_away_score, r.away_score) AS away_score,
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
        stage: row.stage ? (String(row.stage) as TrackedMatch['stage']) : undefined,
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
    const supportsPublicStatus = await hasColumn(this.db, 'match_results', 'public_status');
    await this.db.transaction(async (tx) => {
      const matchResultColumns = [
        'match_id',
        'home_score',
        'away_score',
        'minute',
        'status',
        ...(supportsPublicStatus ? ['public_status'] : []),
        'is_final',
        'provisional_home_score',
        'provisional_away_score',
        'provisional_status',
        'confirmed_home_score',
        'confirmed_away_score',
        'confirmed_at',
        'confirmation_source',
        'confirmation_confidence',
        'needs_review_reason',
        'provider',
        'provider_fixture_id',
        'raw_provider_status',
        'last_checked_at',
        'last_provider_check_at',
        'next_check_at',
        'next_confirmation_check_at',
        'provider_results_json',
        'updated_at',
        'points_recalculated_at'
      ];
      const matchResultValues = [
        update.matchId,
        update.homeScore ?? null,
        update.awayScore ?? null,
        update.minute ?? null,
        update.status,
        ...(supportsPublicStatus ? [update.publicStatus ?? (update.isFinal ? 'CONFIRMED_FINAL' : 'SCHEDULED')] : []),
        update.isFinal ? 1 : 0,
        update.provisionalHomeScore ?? null,
        update.provisionalAwayScore ?? null,
        update.provisionalStatus ?? null,
        update.confirmedHomeScore ?? null,
        update.confirmedAwayScore ?? null,
        update.confirmedAt ?? null,
        update.confirmationSource ?? null,
        update.confirmationConfidence ?? null,
        update.needsReviewReason ?? null,
        update.provider,
        update.providerMatchId ?? null,
        update.rawProviderStatus ?? null,
        update.lastCheckedAt,
        update.lastProviderCheckAt ?? update.lastCheckedAt,
        update.nextCheckAt ?? null,
        update.nextConfirmationCheckAt ?? null,
        update.providerResults ? JSON.stringify(update.providerResults) : null,
        updatedAt,
        null
      ];
      await upsert(tx, 'match_results', matchResultColumns, matchResultValues, ['match_id']);
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
          !previous.isFinal ||
          previous.homeScore !== update.homeScore ||
          previous.awayScore !== update.awayScore ||
          previous.status !== update.status)
    };
  }

  async syncConfirmedScorersForMatch(matchId: number, scorers: NonNullable<ResultUpdate['scorers']>, timestamp: string): Promise<void> {
    await syncConfirmedScorersForMatch(this.db, matchId, scorers, timestamp);
  }

  async getFinalizedResults(): Promise<ResultUpdate[]> {
    return (await this.getAllMatchResults()).filter((result) => result.isFinal && (result.publicStatus === 'CONFIRMED_FINAL' || (result.confirmedHomeScore !== undefined && result.confirmedAwayScore !== undefined)));
  }

  async getProviderResultObservations(matchId: number): Promise<ProviderResultObservation[]> {
    const current = await this.getMatchResult(matchId);
    if (current?.providerResults?.length) return current.providerResults;
    return [];
  }

  async getStatus(provider: string, now: Date): Promise<ResultAgentStatus> {
    const plans = planMatchUpdates(await this.listTrackedMatches(), now);
    const metadata = await this.getLeaderboardMetadata();
    const latestRun = await this.db.one(`
      SELECT started_at, finished_at, checked_matches, updated_matches, finalized_matches, leaderboard_rebuilt, warnings_json, warning_details_json
      FROM result_agent_runs
      ORDER BY finished_at DESC
      LIMIT 1
    `).catch(() => null);
    const latestConfirmedResultCount = Number((await this.db.one(`
      SELECT COUNT(*) AS count
      FROM match_results
      WHERE ${CONFIRMED_FINAL_RESULT_SQL}
    `))?.count ?? 0);
    const warnings = parseWarnings(latestRun?.warnings_json);
    const warningDetails = parseWarningDetails(latestRun?.warning_details_json);
    return {
      lastRunAt: nullableString(latestRun?.finished_at),
      nextSuggestedRunAt: findNextSuggestedRunAt(plans),
      staleMatchesCount: plans.filter((plan) => plan.shouldCheckNow).length,
      provider,
      mode: provider === 'mock-result-provider' ? 'mock' : 'live',
      lastLeaderboardRebuildAt: metadata.lastRebuildAt,
      providerReachable: latestRun ? !warnings.some((warning) => /failed/i.test(warning)) : undefined,
      pendingWarningsCount: warnings.length,
      latestConfirmedResultCount,
      lastRunWarnings: warningDetails.slice(-10),
      lastRunSummary: latestRun ? {
        startedAt: nullableString(latestRun.started_at) ?? nullableString(latestRun.finished_at) ?? '',
        finishedAt: nullableString(latestRun.finished_at) ?? '',
        checkedMatches: Number(latestRun.checked_matches ?? 0),
        updatedMatches: Number(latestRun.updated_matches ?? 0),
        finalizedMatches: Number(latestRun.finalized_matches ?? 0),
        dryRun: Number(latestRun.leaderboard_rebuilt ?? 0) === 0 && warnings.some((warning) => /dry run/i.test(warning)),
        warningsCount: warnings.length
      } : undefined
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
        warning_details_json TEXT NOT NULL DEFAULT '[]',
        provider TEXT NOT NULL,
        mode TEXT NOT NULL
      );
    `);
    await this.db.run(
      `INSERT INTO result_agent_runs (
        id, started_at, finished_at, checked_matches, updated_matches, finalized_matches,
        leaderboard_rebuilt, players_processed, warnings_json, warning_details_json, provider, mode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        JSON.stringify(summary.warningDetails),
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
      for (const entry of entries) {
        await upsert(
          tx,
          'leaderboard_entries',
          [
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
          ],
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
          ],
          ['player_id']
        );
      }
      await deleteLeaderboardRowsNotIn(tx, entries.map((entry) => entry.playerId));
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

  async refreshDerivedTournamentState(timestamp: string): Promise<LeaderboardRebuildResult | undefined> {
    const refreshed = await rebuildPublicTournamentState(this.db, new Date(timestamp));
    return refreshed.leaderboardRebuild;
  }
}

async function deleteLeaderboardRowsNotIn(db: QueryableDatabase, playerIds: string[]): Promise<void> {
  if (playerIds.length === 0) {
    await db.run('DELETE FROM leaderboard_entries');
    return;
  }
  await db.run(`DELETE FROM leaderboard_entries WHERE player_id NOT IN (${playerIds.map(() => '?').join(', ')})`, playerIds);
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
    publicStatus: nullableString(row.public_status) as PublicResultStatus | undefined,
    homeScore: nullableNumber(row.home_score),
    awayScore: nullableNumber(row.away_score),
    minute: nullableNumber(row.minute),
    isFinal: toBoolean(row.is_final),
    lastCheckedAt: nullableString(row.last_checked_at) ?? String(row.updated_at),
    nextCheckAt: nullableString(row.next_check_at),
    provider: nullableString(row.provider) ?? 'unknown',
    rawProviderStatus: nullableString(row.raw_provider_status),
    pointsRecalculatedAt: nullableString(row.points_recalculated_at),
    provisionalHomeScore: nullableNumber(row.provisional_home_score),
    provisionalAwayScore: nullableNumber(row.provisional_away_score),
    provisionalStatus: nullableString(row.provisional_status) as MatchStatus | undefined,
    confirmedHomeScore: nullableNumber(row.confirmed_home_score),
    confirmedAwayScore: nullableNumber(row.confirmed_away_score),
    confirmedAt: nullableString(row.confirmed_at),
    confirmationSource: nullableString(row.confirmation_source),
    confirmationConfidence: nullableString(row.confirmation_confidence) as ResultUpdate['confirmationConfidence'],
    needsReviewReason: nullableString(row.needs_review_reason),
    lastProviderCheckAt: nullableString(row.last_provider_check_at),
    nextConfirmationCheckAt: nullableString(row.next_confirmation_check_at),
    providerResults: parseProviderResults(row.provider_results_json)
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

function parseWarnings(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function parseWarningDetails(value: unknown): ResultAgentWarningDetail[] {
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isWarningDetail) : [];
  } catch {
    return [];
  }
}

function isWarningDetail(value: unknown): value is ResultAgentWarningDetail {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.internalMatchId === 'number' &&
    typeof row.homeTeam === 'string' &&
    typeof row.awayTeam === 'string' &&
    typeof row.kickoffAt === 'string' &&
    typeof row.providerStatus === 'string' &&
    typeof row.normalizedStatus === 'string' &&
    typeof row.reason === 'string' &&
    typeof row.action === 'string';
}

function parseProviderResults(value: unknown): ProviderResultObservation[] | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    return parsed.filter(isProviderResultObservation);
  } catch {
    return undefined;
  }
}

function isProviderResultObservation(value: unknown): value is ProviderResultObservation {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.provider === 'string' &&
    typeof row.matchId === 'number' &&
    typeof row.status === 'string' &&
    typeof row.isFinal === 'boolean' &&
    typeof row.observedAt === 'string';
}
