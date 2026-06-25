import { randomUUID } from 'node:crypto';
import type { QueryableDatabase } from '../databaseAdapter.js';
import { normalizeScorerName } from './scorerNormalization.js';
import { resolveScorerIdentity, scorerIdentityGroupKey } from '../../domain/scorerIdentity.js';
import { migrateResultPersistenceSchema } from './resultPersistenceSchema.js';
import { CONFIRMED_FINAL_RESULT_SQL } from './finalizedResultState.js';
import { loadResultProviderConfig } from './resultProviderConfig.js';
import { OpenWorldCupResultProvider } from './openWorldCupResultProvider.js';
import type { ResultProvider } from './resultProvider.js';
import type { ResultScorer, TrackedMatch } from './resultTypes.js';
import { getManualScorerCorrections, MANUAL_UNKNOWN_SCORER_NAME, isManualUnknownScorerName } from './manualScorerCorrections.js';

export interface ScorerBackfillResult {
  repaired: boolean;
  reason: string;
  repairedMatches: number;
  scorerFactsInserted: number;
  scorerFactsUpdated: number;
  scorerFactsSkipped: number;
}

export interface BackfillTopScorersOptions {
  provider?: Pick<ResultProvider, 'fetchMatchUpdate'>;
}

export async function backfillTopScorersFromConfirmedResults(
  db: QueryableDatabase,
  nowIso: string,
  options: BackfillTopScorersOptions = {}
): Promise<ScorerBackfillResult> {
  await migrateResultPersistenceSchema(db);
  const confirmedResults = await db.all(`
    SELECT
      r.match_id,
      r.provider_results_json,
      r.confirmed_home_score,
      r.confirmed_away_score,
      r.status,
      r.is_final,
      r.provider_fixture_id,
      r.last_checked_at,
      r.confirmed_at,
      r.updated_at,
      m.kickoff_at,
      m.home_team_id,
      m.away_team_id,
      m.home_slot,
      m.away_slot,
      COALESCE(home.name, m.home_slot) AS home_team,
      COALESCE(away.name, m.away_slot) AS away_team,
      COALESCE(home.code, '') AS home_team_code,
      COALESCE(away.code, '') AS away_team_code
    FROM match_results r
    JOIN matches m ON m.id = r.match_id
    LEFT JOIN teams home ON home.id = m.home_team_id
    LEFT JOIN teams away ON away.id = m.away_team_id
    WHERE ${CONFIRMED_FINAL_RESULT_SQL}
    ORDER BY r.match_id
  `);
  if (confirmedResults.length === 0) {
    return emptyBackfillResult('no-confirmed-results');
  }

  let repairedMatches = 0;
  let scorerFactsInserted = 0;
  let scorerFactsUpdated = 0;
  let scorerFactsSkipped = 0;
  for (const result of confirmedResults) {
    const matchId = Number(result.match_id);
    const expectedGoals = Number(result.confirmed_home_score ?? 0) + Number(result.confirmed_away_score ?? 0);
    const storedScorers = parseProviderScorers(result.provider_results_json);
    const liveScorers = storedScorers.length >= expectedGoals ? [] : await fetchCurrentProviderScorers(result as {
      match_id: number;
      kickoff_at?: string;
      home_team?: string;
      away_team?: string;
    }, nowIso, options.provider);
    const providerScorers = choosePreferredScorers(storedScorers, liveScorers);
    const manualCorrectionScorers = await loadManualCorrectionScorersForMatch(db, matchId);
    const manualScorers = getManualScorerCorrections(matchId);
    const existingScorers = manualCorrectionScorers.length > 0 || providerScorers.length > 0
      ? []
      : await loadExistingScorersForMatch(db, matchId);
    const resolvedScorers = manualCorrectionScorers.length > 0
      ? manualCorrectionScorers
      : providerScorers.length > 0
        ? providerScorers
        : manualScorers.length > 0
          ? manualScorers
          : existingScorers;
    const scorers = fillMissingScorers(
      resolvedScorers,
      expectedGoals,
      {
        homeTeam: String(result.home_team ?? result.home_slot ?? ''),
        homeTeamCode: stringOrUndefined(result.home_team_code),
        awayTeam: String(result.away_team ?? result.away_slot ?? ''),
        awayTeamCode: stringOrUndefined(result.away_team_code)
      }
    );

    if (scorers.length === 0) {
      scorerFactsSkipped += 1;
      continue;
    }
    const existingFacts = await countScorerFactsForMatch(db, matchId);
    await syncConfirmedScorersForMatch(db, matchId, scorers, nowIso);
    repairedMatches += 1;
    if (existingFacts > 0) {
      scorerFactsUpdated += scorers.length;
    } else {
      scorerFactsInserted += scorers.length;
    }
  }

  return {
    repaired: repairedMatches > 0,
    reason: repairedMatches > 0 ? 'backfilled-from-confirmed-results' : 'no-provider-scorers-found',
    repairedMatches,
    scorerFactsInserted,
    scorerFactsUpdated,
    scorerFactsSkipped
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
    for (const scorer of scorers) {
      const identity = resolveScorerIdentity(scorer);
      if (!identity.playerName) continue;
      const team = await resolveTeam(tx, scorer);
      const id = `${matchId}-${randomUUID()}`;
      await tx.run(
        `INSERT INTO result_manual_scorers (
          id, match_id, player_id, provider_player_id, raw_player_name, player_name, team_id, team_code, goals, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          matchId,
          identity.playerId ?? null,
          identity.providerPlayerId ?? null,
          scorer.rawPlayerName ?? scorer.playerName,
          identity.playerName,
          team.teamId ?? null,
          team.teamCode ?? scorer.teamCode ?? null,
          scorer.goals,
          nowIso
        ]
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

export async function countUnknownManualScorerGoals(db: QueryableDatabase): Promise<number> {
  return Number((await db.one(`
    SELECT COALESCE(SUM(COALESCE(goals, 0)), 0) AS total
    FROM result_manual_scorers
    WHERE player_name = ?
  `, [MANUAL_UNKNOWN_SCORER_NAME]))?.total ?? 0);
}

export async function countVisibleScorerFactGoals(db: QueryableDatabase): Promise<number> {
  return Number((await db.one(`
    SELECT COALESCE(SUM(CASE WHEN player_name = ? THEN 0 ELSE COALESCE(goals, 0) END), 0) AS total
    FROM result_manual_scorers
  `, [MANUAL_UNKNOWN_SCORER_NAME]))?.total ?? 0);
}

async function rebuildTopScorerStandingsInTransaction(db: QueryableDatabase, nowIso: string): Promise<void> {
  const rows = await db.all(`
    SELECT player_id, provider_player_id, player_name, team_id, team_code, goals
    FROM result_manual_scorers
    ORDER BY match_id, created_at, player_name
  `);
  const grouped = new Map<string, { playerId: string | null; providerPlayerId: string | null; playerName: string; teamId: string | null; goals: number }>();
  for (const row of rows) {
    if (isManualUnknownScorerName(String(row.player_name ?? ''))) continue;
    const playerId = row.player_id === null || row.player_id === undefined || row.player_id === '' ? undefined : String(row.player_id);
    const providerPlayerId = row.provider_player_id === null || row.provider_player_id === undefined || row.provider_player_id === '' ? undefined : String(row.provider_player_id);
    const identity = resolveScorerIdentity({ playerName: String(row.player_name ?? ''), playerId, providerPlayerId });
    if (!identity.playerName) continue;
    const goals = Number(row.goals ?? 0);
    if (!Number.isFinite(goals) || goals <= 0) continue;
    const teamId = row.team_id === null || row.team_id === undefined || row.team_id === '' ? null : String(row.team_id);
    const teamCode = row.team_code === null || row.team_code === undefined || row.team_code === '' ? null : String(row.team_code);
    const key = scorerIdentityGroupKey({ playerName: identity.playerName, playerId: identity.playerId, providerPlayerId: identity.providerPlayerId, teamId, teamCode });
    const existing = grouped.get(key);
    if (existing) {
      existing.goals += goals;
    } else {
      grouped.set(key, {
        playerId: identity.playerId ?? null,
        providerPlayerId: identity.providerPlayerId ?? null,
        playerName: identity.playerName,
        teamId,
        goals
      });
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
      `INSERT INTO top_scorer_standings (id, rank, player_id, provider_player_id, player_name, team_id, goals, assists, minutes_played, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `${index + 1}-${row.playerId ?? row.providerPlayerId ?? slug(row.playerName)}-${row.teamId ?? 'unknown'}`,
        index + 1,
        row.playerId,
        row.providerPlayerId,
        row.playerName,
        row.teamId,
        row.goals,
        0,
        null,
        nowIso
      ]
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

async function countScorerFactsForMatch(db: QueryableDatabase, matchId: number): Promise<number> {
  return Number((await db.one('SELECT COUNT(*) AS count FROM result_manual_scorers WHERE match_id = ?', [matchId]))?.count ?? 0);
}

async function loadExistingScorersForMatch(db: QueryableDatabase, matchId: number): Promise<ResultScorer[]> {
  const rows = await db.all(`
    SELECT player_name, player_id, provider_player_id, raw_player_name, team_code, goals
    FROM result_manual_scorers
    WHERE match_id = ?
    ORDER BY created_at, player_name
  `, [matchId]);
  return rows.flatMap((row) => {
    const playerName = typeof row.player_name === 'string' ? normalizeScorerName(row.player_name) : '';
    const goals = Number(row.goals ?? 0);
    if (!playerName || !Number.isInteger(goals) || goals <= 0) return [];
    return [{
      playerName,
      playerId: typeof row.player_id === 'string' && row.player_id.trim() ? row.player_id.trim() : undefined,
      providerPlayerId: typeof row.provider_player_id === 'string' && row.provider_player_id.trim() ? row.provider_player_id.trim() : undefined,
      rawPlayerName: typeof row.raw_player_name === 'string' ? row.raw_player_name : undefined,
      teamCode: typeof row.team_code === 'string' && row.team_code.trim() ? row.team_code.trim() : undefined,
      goals
    }];
  });
}

async function loadManualCorrectionScorersForMatch(db: QueryableDatabase, matchId: number): Promise<ResultScorer[]> {
  const row = await db.one(`
    SELECT scorers_json
    FROM result_manual_corrections
    WHERE match_id = ?
      AND scorers_json IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1
  `, [matchId]);
  if (!row?.scorers_json || typeof row.scorers_json !== 'string') return [];
  try {
    const parsed = JSON.parse(row.scorers_json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => normalizeScorer(item));
  } catch {
    return [];
  }
}

function emptyBackfillResult(reason: string): ScorerBackfillResult {
  return {
    repaired: false,
    reason,
    repairedMatches: 0,
    scorerFactsInserted: 0,
    scorerFactsUpdated: 0,
    scorerFactsSkipped: 0
  };
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
  const rawPlayerId = scorer.playerId ?? scorer.player_id ?? scorer.canonicalPlayerId ?? scorer.canonical_player_id;
  const playerId = typeof rawPlayerId === 'string' || typeof rawPlayerId === 'number' ? String(rawPlayerId).trim() : undefined;
  const rawProviderPlayerId = scorer.providerPlayerId ?? scorer.provider_player_id ?? scorer.providerId ?? scorer.provider_id;
  const providerPlayerId = typeof rawProviderPlayerId === 'string' || typeof rawProviderPlayerId === 'number' ? String(rawProviderPlayerId).trim() : undefined;
  const goals = Number(scorer.goals ?? 1);
  if (!playerName || !Number.isInteger(goals) || goals <= 0) return [];
  if (!teamName && !teamCode) return [];
  return [{
    playerName,
    playerId: playerId || undefined,
    providerPlayerId: providerPlayerId || undefined,
    rawPlayerName: typeof rawPlayerName === 'string' ? rawPlayerName : undefined,
    teamName: teamName || undefined,
    teamCode: teamCode || undefined,
    goals
  }];
}

async function fetchCurrentProviderScorers(
  result: {
    match_id: number;
    kickoff_at?: string;
    home_team?: string;
    away_team?: string;
  },
  nowIso: string,
  providerOverride?: Pick<ResultProvider, 'fetchMatchUpdate'>
): Promise<ResultScorer[]> {
  try {
    const provider = providerOverride ?? await buildOpenWorldCupProvider();
    if (!provider) return [];
    const match = buildTrackedMatch(result);
    const update = await provider.fetchMatchUpdate(match, new Date(nowIso));
    return update.scorers ?? [];
  } catch {
    return [];
  }
}

async function buildOpenWorldCupProvider(): Promise<Pick<ResultProvider, 'fetchMatchUpdate'> | undefined> {
  const config = loadResultProviderConfig();
  if (!config.openWorldCup.apiBaseUrl) return undefined;
  return new OpenWorldCupResultProvider(config.openWorldCup);
}

function buildTrackedMatch(result: {
  match_id: number;
  kickoff_at?: string;
  home_team?: string;
  away_team?: string;
}): TrackedMatch {
  return {
    id: Number(result.match_id),
    kickoffUtc: String(result.kickoff_at ?? new Date().toISOString()),
    status: 'FINISHED',
    homeTeam: String(result.home_team ?? ''),
    awayTeam: String(result.away_team ?? ''),
    isFinal: true
  };
}

function choosePreferredScorers(primary: ResultScorer[], secondary: ResultScorer[]): ResultScorer[] {
  const primaryGoals = scorerGoalTotal(primary);
  const secondaryGoals = scorerGoalTotal(secondary);
  if (secondaryGoals > primaryGoals) return secondary;
  if (primaryGoals > secondaryGoals) return primary;
  if (secondary.length > primary.length) return secondary;
  return primary.length > 0 ? primary : secondary;
}

function scorerGoalTotal(scorers: ResultScorer[]): number {
  return scorers.reduce((total, scorer) => total + Number(scorer.goals ?? 0), 0);
}

function fillMissingScorers(
  scorers: ResultScorer[],
  expectedGoals: number,
  teams: {
    homeTeam: string;
    homeTeamCode?: string;
    awayTeam: string;
    awayTeamCode?: string;
  }
): ResultScorer[] {
  const totalGoals = scorerGoalTotal(scorers);
  if (totalGoals >= expectedGoals) return scorers;
  const fillers: ResultScorer[] = [];
  for (let index = 0; index < expectedGoals - totalGoals; index += 1) {
    fillers.push({
      playerName: MANUAL_UNKNOWN_SCORER_NAME,
      teamName: teams.homeTeam || teams.awayTeam || undefined,
      teamCode: teams.homeTeamCode ?? teams.awayTeamCode,
      goals: 1
    });
  }
  return [...scorers, ...fillers];
}

function stringOrUndefined(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return String(value);
}
