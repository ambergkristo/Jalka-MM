import providerMatchMapSeed from '../../data/providerMatchMap.example.json' with { type: 'json' };
import type { QueryableDatabase } from '../databaseAdapter.js';
import { CONFIRMED_FINAL_RESULT_SQL } from './finalizedResultState.js';
import { migrateResultPersistenceSchema } from './resultPersistenceSchema.js';
import { loadResultProviderConfig } from './resultProviderConfig.js';
import type { ProviderMatchMapEntry } from './providerMatchMap.js';
import type { ResultAgentStatus } from './resultTypes.js';

const DEFAULT_POLLING_INTERVAL_SECONDS = 60;
const PROCESS_STARTED_AT = new Date();

export type ProviderHealthStatus = 'ProviderHealthy' | 'ProviderDelayed' | 'ProviderDegraded' | 'ProviderCritical';

export interface ProviderHealthPayload {
  generatedAt: string;
  status: ProviderHealthStatus;
  providerStatus: {
    activeProviderName: string;
    providerMode: 'mock' | 'live';
    writeMode?: 'mock' | 'dry-run' | 'live';
    lastSuccessfulPollAt?: string;
    lastFailedPollAt?: string;
    pollingIntervalSeconds: number;
    processUptimeSeconds: number;
  };
  matchHealth: {
    totalMatches: number;
    confirmedMatches: number;
    liveOrProvisionalMatches: number;
    upcomingMatches: number;
    awaitingConfirmationMatches: number;
  };
  delayedConfirmationWarnings: Array<{
    matchId: number;
    match: string;
    kickoffAt: string;
    minutesSinceKickoff: number;
    currentProviderState: string;
    severity: 'delayed' | 'critical';
  }>;
  scorerHealth: {
    confirmedGoalsCount: number;
    scorerFactsGoalsCount: number;
    missingGoalsCount: number;
    hasMismatch: boolean;
    mismatchDetails: Array<{
      matchId: number;
      match: string;
      teams: {
        home: string;
        away: string;
      };
      finalScore: string;
      expectedGoalsCount: number;
      persistedScorerFactsCount: number;
      missingGoalsCount: number;
      providerScorerCount?: number;
      source: string;
      status: string;
      lastUpdatedAt?: string;
    }>;
  };
  manualOverrideSafety: {
    manualCorrectedMatchesCount: number;
    confirmedManualResultsCount: number;
    staleProviderOverwriteAttemptsBlockedCount: number | null;
    staleProviderOverwriteAttemptsAvailable: boolean;
    manualOverrideProtectionActive: boolean;
  };
  providerVerifierStatus: {
    enabled: boolean;
    status: 'Verifier active' | 'Verifier inactive';
    lastVerifierCheckAt?: string;
    providerDisagreementsDetected: number;
    unresolvedDisagreementsCount: number;
  };
}

export async function collectProviderHealth(input: {
  db: QueryableDatabase;
  now?: Date;
  processStartedAt?: Date;
  resultAgentStatus: ResultAgentStatus & { providerChain?: string[]; writeMode?: 'mock' | 'dry-run' | 'live' };
  pollingIntervalSeconds?: number;
  providerMatchMap?: ProviderMatchMapEntry[];
}): Promise<ProviderHealthPayload> {
  const now = input.now ?? new Date();
  await migrateResultPersistenceSchema(input.db);

  const providerPolls = await getProviderPollState(input.db);
  const matchHealth = await getMatchHealth(input.db, now);
  const delayedConfirmationWarnings = await getDelayedConfirmationWarnings(input.db, now);
  const scorerHealth = await getScorerHealth(input.db);
  const manualOverrideSafety = await getManualOverrideSafety(input.db);
  const providerVerifierStatus = await getProviderVerifierStatus(input.db, input.providerMatchMap ?? providerMatchMapSeed as ProviderMatchMapEntry[]);
  const pollingIntervalSeconds = input.pollingIntervalSeconds ?? derivePollingIntervalSeconds(input.resultAgentStatus);

  const status = classifyProviderHealth({
    delayedConfirmationWarnings,
    scorerMismatchGoalsCount: Math.abs(scorerHealth.confirmedGoalsCount - scorerHealth.scorerFactsGoalsCount),
    activePollingFailure: isActivePollingFailure(providerPolls.lastSuccessfulPollAt, providerPolls.lastFailedPollAt) || input.resultAgentStatus.providerReachable === false
  });

  return {
    generatedAt: now.toISOString(),
    status,
    providerStatus: {
      activeProviderName: input.resultAgentStatus.provider,
      providerMode: input.resultAgentStatus.mode,
      writeMode: input.resultAgentStatus.writeMode,
      lastSuccessfulPollAt: providerPolls.lastSuccessfulPollAt,
      lastFailedPollAt: providerPolls.lastFailedPollAt,
      pollingIntervalSeconds,
      processUptimeSeconds: Math.max(0, Math.floor((now.getTime() - (input.processStartedAt ?? PROCESS_STARTED_AT).getTime()) / 1000))
    },
    matchHealth,
    delayedConfirmationWarnings,
    scorerHealth,
    manualOverrideSafety,
    providerVerifierStatus
  };
}

export function classifyProviderHealth(input: {
  delayedConfirmationWarnings: Array<{ severity: 'delayed' | 'critical' }>;
  scorerMismatchGoalsCount: number;
  activePollingFailure?: boolean;
}): ProviderHealthStatus {
  if (input.activePollingFailure || input.delayedConfirmationWarnings.some((warning) => warning.severity === 'critical')) return 'ProviderCritical';
  if (input.scorerMismatchGoalsCount > 5 || input.delayedConfirmationWarnings.length >= 3) return 'ProviderDegraded';
  if (input.delayedConfirmationWarnings.length > 0) return 'ProviderDelayed';
  return 'ProviderHealthy';
}

async function getProviderPollState(db: QueryableDatabase): Promise<{ lastSuccessfulPollAt?: string; lastFailedPollAt?: string }> {
  const runs = await db.all(`
    SELECT finished_at, warnings_json
    FROM result_agent_runs
    ORDER BY finished_at DESC
    LIMIT 25
  `).catch(() => []);
  const latestWarningRows = await db.all(`
    SELECT last_checked_at, warning, error_message
    FROM result_updates
    WHERE warning IS NOT NULL OR error_message IS NOT NULL
    ORDER BY last_checked_at DESC
    LIMIT 25
  `).catch(() => []);

  const lastSuccessfulPollAt = runs.find((row) => !rowHasProviderFailure(row))?.finished_at;
  const failedRunAt = runs.find(rowHasProviderFailure)?.finished_at;
  const failedUpdateAt = latestWarningRows.find((row) => rowHasProviderFailure(row))?.last_checked_at;

  return {
    lastSuccessfulPollAt: stringOrUndefined(lastSuccessfulPollAt),
    lastFailedPollAt: latestIsoString(stringOrUndefined(failedRunAt), stringOrUndefined(failedUpdateAt))
  };
}

async function getMatchHealth(db: QueryableDatabase, now: Date): Promise<ProviderHealthPayload['matchHealth']> {
  const row = await db.one(`
    SELECT
      COUNT(*) AS total_matches,
      SUM(CASE WHEN ${CONFIRMED_FINAL_RESULT_SQL} THEN 1 ELSE 0 END) AS confirmed_matches,
      SUM(CASE WHEN COALESCE(r.public_status, 'SCHEDULED') IN ('LIVE', 'CONFIRMING', 'NEEDS_REVIEW') AND NOT COALESCE((${CONFIRMED_FINAL_RESULT_SQL}), false) THEN 1 ELSE 0 END) AS live_or_provisional_matches,
      SUM(CASE WHEN m.kickoff_at > ? AND NOT COALESCE((${CONFIRMED_FINAL_RESULT_SQL}), false) THEN 1 ELSE 0 END) AS upcoming_matches,
      SUM(CASE WHEN NOT COALESCE((${CONFIRMED_FINAL_RESULT_SQL}), false) AND (
        COALESCE(r.public_status, 'SCHEDULED') = 'CONFIRMING'
        OR r.next_confirmation_check_at IS NOT NULL
        OR (m.kickoff_at <= ? AND COALESCE(r.public_status, 'SCHEDULED') <> 'LIVE')
      ) THEN 1 ELSE 0 END) AS awaiting_confirmation_matches
    FROM matches m
    LEFT JOIN match_results r ON r.match_id = m.id
  `, [now.toISOString(), now.toISOString()]);
  return {
    totalMatches: Number(row?.total_matches ?? 0),
    confirmedMatches: Number(row?.confirmed_matches ?? 0),
    liveOrProvisionalMatches: Number(row?.live_or_provisional_matches ?? 0),
    upcomingMatches: Number(row?.upcoming_matches ?? 0),
    awaitingConfirmationMatches: Number(row?.awaiting_confirmation_matches ?? 0)
  };
}

async function getDelayedConfirmationWarnings(db: QueryableDatabase, now: Date): Promise<ProviderHealthPayload['delayedConfirmationWarnings']> {
  const rows = await db.all(`
    SELECT
      m.id,
      m.kickoff_at,
      COALESCE(home.name, m.home_slot) AS home_team,
      COALESCE(away.name, m.away_slot) AS away_team,
      COALESCE(r.raw_provider_status, r.public_status, r.status, 'SCHEDULED') AS provider_state
    FROM matches m
    LEFT JOIN match_results r ON r.match_id = m.id
    LEFT JOIN teams home ON home.id = m.home_team_id
    LEFT JOIN teams away ON away.id = m.away_team_id
    WHERE NOT COALESCE((${CONFIRMED_FINAL_RESULT_SQL}), false)
    ORDER BY m.kickoff_at, m.id
  `);
  return rows.flatMap((row) => {
    const kickoffAt = stringOrUndefined(row.kickoff_at);
    if (!kickoffAt) return [];
    const kickoffMs = Date.parse(kickoffAt);
    if (Number.isNaN(kickoffMs)) return [];
    const minutesSinceKickoff = Math.floor((now.getTime() - kickoffMs) / 60_000);
    if (minutesSinceKickoff <= 120) return [];
    return [{
      matchId: Number(row.id),
      match: `${String(row.home_team)} vs ${String(row.away_team)}`,
      kickoffAt,
      minutesSinceKickoff,
      currentProviderState: String(row.provider_state ?? 'SCHEDULED'),
      severity: minutesSinceKickoff > 180 ? 'critical' as const : 'delayed' as const
    }];
  });
}

async function getScorerHealth(db: QueryableDatabase): Promise<ProviderHealthPayload['scorerHealth']> {
  const confirmedGoalsRow = await db.one(`
    SELECT COALESCE(SUM(COALESCE(r.confirmed_home_score, r.home_score, 0) + COALESCE(r.confirmed_away_score, r.away_score, 0)), 0) AS total
    FROM match_results r
    WHERE ${CONFIRMED_FINAL_RESULT_SQL}
  `);
  const scorerGoalsRow = await db.one(`
    SELECT COALESCE(SUM(COALESCE(goals, 0)), 0) AS total
    FROM result_manual_scorers
  `);
  const confirmedGoalsCount = Number(confirmedGoalsRow?.total ?? 0);
  const scorerFactsGoalsCount = Number(scorerGoalsRow?.total ?? 0);
  return {
    confirmedGoalsCount,
    scorerFactsGoalsCount,
    missingGoalsCount: Math.max(confirmedGoalsCount - scorerFactsGoalsCount, 0),
    hasMismatch: confirmedGoalsCount !== scorerFactsGoalsCount,
    mismatchDetails: await getScorerMismatchDetails(db)
  };
}

async function getScorerMismatchDetails(db: QueryableDatabase): Promise<ProviderHealthPayload['scorerHealth']['mismatchDetails']> {
  const rows = await db.all(`
    SELECT
      r.match_id,
      COALESCE(home.name, m.home_slot) AS home_team,
      COALESCE(away.name, m.away_slot) AS away_team,
      COALESCE(r.confirmed_home_score, r.home_score, 0) AS home_score,
      COALESCE(r.confirmed_away_score, r.away_score, 0) AS away_score,
      COALESCE(facts.scorer_goals, 0) AS scorer_goals,
      r.provider_results_json,
      COALESCE(r.confirmation_source, r.provider, 'unknown') AS source,
      COALESCE(r.public_status, r.status, 'unknown') AS status,
      COALESCE(r.updated_at, r.confirmed_at, r.last_checked_at) AS last_updated_at
    FROM match_results r
    JOIN matches m ON m.id = r.match_id
    LEFT JOIN teams home ON home.id = m.home_team_id
    LEFT JOIN teams away ON away.id = m.away_team_id
    LEFT JOIN (
      SELECT match_id, COALESCE(SUM(COALESCE(goals, 0)), 0) AS scorer_goals
      FROM result_manual_scorers
      GROUP BY match_id
    ) facts ON facts.match_id = r.match_id
    WHERE ${CONFIRMED_FINAL_RESULT_SQL}
    ORDER BY r.match_id
  `);

  return rows.flatMap((row) => {
    const homeScore = Number(row.home_score ?? 0);
    const awayScore = Number(row.away_score ?? 0);
    const expectedGoalsCount = homeScore + awayScore;
    const persistedScorerFactsCount = Number(row.scorer_goals ?? 0);
    if (expectedGoalsCount === persistedScorerFactsCount) return [];
    const home = String(row.home_team ?? 'Home');
    const away = String(row.away_team ?? 'Away');
    return [{
      matchId: Number(row.match_id),
      match: `${home} ${homeScore}-${awayScore} ${away}`,
      teams: { home, away },
      finalScore: `${homeScore}-${awayScore}`,
      expectedGoalsCount,
      persistedScorerFactsCount,
      missingGoalsCount: Math.max(expectedGoalsCount - persistedScorerFactsCount, 0),
      providerScorerCount: providerScorerGoalsCount(row.provider_results_json),
      source: String(row.source ?? 'unknown'),
      status: String(row.status ?? 'unknown'),
      lastUpdatedAt: stringOrUndefined(row.last_updated_at)
    }];
  });
}

async function getManualOverrideSafety(db: QueryableDatabase): Promise<ProviderHealthPayload['manualOverrideSafety']> {
  const manualCorrected = await db.one(`
    SELECT COUNT(DISTINCT match_id) AS count
    FROM result_manual_corrections
  `);
  const confirmedManual = await db.one(`
    SELECT COUNT(*) AS count
    FROM match_results
    WHERE ${CONFIRMED_FINAL_RESULT_SQL}
      AND (confirmation_confidence = 'manual' OR confirmation_source LIKE 'manual%')
  `);
  return {
    manualCorrectedMatchesCount: Number(manualCorrected?.count ?? 0),
    confirmedManualResultsCount: Number(confirmedManual?.count ?? 0),
    staleProviderOverwriteAttemptsBlockedCount: null,
    staleProviderOverwriteAttemptsAvailable: false,
    manualOverrideProtectionActive: true
  };
}

async function getProviderVerifierStatus(
  db: QueryableDatabase,
  providerMatchMap: ProviderMatchMapEntry[]
): Promise<ProviderHealthPayload['providerVerifierStatus']> {
  const config = loadResultProviderConfig();
  const enabled = isFootballDataVerifierEnabled(config, providerMatchMap);
  if (!enabled) {
    return {
      enabled: false,
      status: 'Verifier inactive',
      providerDisagreementsDetected: 0,
      unresolvedDisagreementsCount: 0
    };
  }

  const lastVerifier = await db.one(`
    SELECT MAX(last_checked_at) AS last_checked_at
    FROM result_updates
    WHERE source = 'football-data-result-provider'
  `);
  const disagreements = await db.one(`
    SELECT COUNT(*) AS count
    FROM match_results
    WHERE public_status = 'NEEDS_REVIEW'
      AND COALESCE(needs_review_reason, '') LIKE '%disagree%'
  `);
  const disagreementCount = Number(disagreements?.count ?? 0);
  return {
    enabled: true,
    status: 'Verifier active',
    lastVerifierCheckAt: stringOrUndefined(lastVerifier?.last_checked_at),
    providerDisagreementsDetected: disagreementCount,
    unresolvedDisagreementsCount: disagreementCount
  };
}

function isFootballDataVerifierEnabled(
  config: ReturnType<typeof loadResultProviderConfig>,
  providerMatchMap: ProviderMatchMapEntry[]
): boolean {
  if (config.providerChain.includes('football-data')) return true;
  if (!config.providerChain.includes('free-worldcup')) return false;
  if (!config.footballData.apiKey || !config.footballData.apiBaseUrl) return false;
  return providerMatchMap.some((entry) =>
    entry.provider === 'football-data' &&
    entry.providerFixtureId &&
    entry.confidence === 'confirmed' &&
    (!config.footballData.competitionId || entry.providerCompetitionId === config.footballData.competitionId) &&
    (!config.footballData.season || entry.providerSeason === config.footballData.season)
  );
}

function derivePollingIntervalSeconds(status: ResultAgentStatus): number {
  const lastRunAt = Date.parse(status.lastRunAt ?? '');
  const nextRunAt = Date.parse(status.nextSuggestedRunAt ?? '');
  if (Number.isFinite(lastRunAt) && Number.isFinite(nextRunAt) && nextRunAt > lastRunAt) {
    return Math.max(1, Math.round((nextRunAt - lastRunAt) / 1000));
  }
  return DEFAULT_POLLING_INTERVAL_SECONDS;
}

function isActivePollingFailure(lastSuccessfulPollAt?: string, lastFailedPollAt?: string): boolean {
  if (!lastFailedPollAt) return false;
  if (!lastSuccessfulPollAt) return true;
  return Date.parse(lastFailedPollAt) > Date.parse(lastSuccessfulPollAt);
}

function rowHasProviderFailure(row: Record<string, unknown>): boolean {
  const warnings = parseWarnings(row.warnings_json);
  const freeform = [row.warning, row.error_message].map((value) => String(value ?? '')).join(' ');
  return warnings.some((warning) => /failed|request failed|timeout|network|quota|invalid provider/i.test(warning)) ||
    /failed|request failed|timeout|network|quota|invalid provider/i.test(freeform);
}

function parseWarnings(value: unknown): string[] {
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function stringOrUndefined(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return String(value);
}

function providerScorerGoalsCount(value: unknown): number | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    const scorerLists = parsed.flatMap((observation) => {
      if (!observation || typeof observation !== 'object') return [];
      const scorers = (observation as Record<string, unknown>).scorers;
      return Array.isArray(scorers) && scorers.length > 0 ? [scorers] : [];
    });
    const latestScorers = scorerLists.at(-1);
    if (!latestScorers) return undefined;
    return latestScorers.reduce((total, scorer) => total + scorerGoalCount(scorer), 0);
  } catch {
    return undefined;
  }
}

function scorerGoalCount(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  const goals = Number((value as Record<string, unknown>).goals ?? 1);
  return Number.isFinite(goals) && goals > 0 ? goals : 0;
}

function latestIsoString(...values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
}
