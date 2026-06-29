import type { QueryableDatabase } from '../databaseAdapter.js';
import { isConfirmedFinalResult } from './finalizedResultState.js';
import { buildCanonicalPlayoffFixtures, type CanonicalPlayoffFixture } from './playoffState.js';
import { derivePublicResultStatus } from './publicResultStatus.js';
import type { MatchStatus, PublicResultStatus, TrackedMatch } from './resultTypes.js';

export interface CanonicalRuntimeMatch {
  id: number;
  stage?: TrackedMatch['stage'];
  kickoffAt: string;
  providerFixtureId?: string;
  publicStatus: PublicResultStatus;
  status: MatchStatus;
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeTeamCode?: string;
  awayTeamCode?: string;
  homeScore?: number;
  awayScore?: number;
  minute?: number;
  isFinal: boolean;
  lastCheckedAt?: string;
  nextCheckAt?: string;
  nextConfirmationCheckAt?: string;
  needsReviewReason?: string;
  rawProviderStatus?: string;
  confirmationConfidence?: string;
  confirmedHomeScore?: number;
  confirmedAwayScore?: number;
}

export async function listCanonicalRuntimeMatches(db: QueryableDatabase, now = new Date()): Promise<CanonicalRuntimeMatch[]> {
  const rows = await db.all(`
    SELECT
      m.id,
      m.stage,
      m.kickoff_at,
      m.home_team_id,
      m.away_team_id,
      COALESCE(t_home.name_et, t_home.name, m.home_slot) AS home_team,
      COALESCE(t_away.name_et, t_away.name, m.away_slot) AS away_team,
      t_home.code AS home_team_code,
      t_away.code AS away_team_code,
      r.provider_fixture_id,
      r.status,
      r.public_status,
      r.home_score,
      r.away_score,
      r.minute,
      r.is_final,
      r.last_checked_at,
      r.next_check_at,
      r.next_confirmation_check_at,
      r.needs_review_reason,
      r.raw_provider_status,
      r.confirmation_confidence,
      r.confirmed_home_score,
      r.confirmed_away_score,
      r.provisional_home_score,
      r.provisional_away_score,
      r.provisional_status
    FROM matches m
    LEFT JOIN match_results r ON r.match_id = m.id
    LEFT JOIN teams t_home ON t_home.id = m.home_team_id
    LEFT JOIN teams t_away ON t_away.id = m.away_team_id
    ORDER BY m.id
  `);
  const playoffFixtures = await buildCanonicalPlayoffFixtures(now).catch(() => []);
  const playoffFixtureByMatchId = new Map(playoffFixtures.map((fixture) => [fixture.matchId, fixture]));

  return rows.map((row) => toCanonicalRuntimeMatch(row, playoffFixtureByMatchId.get(Number(row.id))));
}

export function toTrackedMatch(match: CanonicalRuntimeMatch): TrackedMatch {
  return {
    id: match.id,
    stage: match.stage,
    providerMatchId: match.providerFixtureId,
    kickoffUtc: match.kickoffAt,
    status: match.status,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeScore: match.confirmedHomeScore ?? match.homeScore,
    awayScore: match.confirmedAwayScore ?? match.awayScore,
    minute: match.minute,
    isFinal: match.isFinal,
    lastCheckedAt: match.lastCheckedAt,
    nextCheckAt: match.nextCheckAt
  };
}

function toCanonicalRuntimeMatch(
  row: Record<string, unknown>,
  playoffFixture: CanonicalPlayoffFixture | undefined
): CanonicalRuntimeMatch {
  const publicStatus = normalizePublicStatus(row.public_status) ?? derivePublicResultStatus(row);
  const provisionalStatus = normalizeMatchStatus(row.provisional_status);
  const kickoffAt = stringOrUndefined(playoffFixture?.kickoffAt) ?? String(row.kickoff_at);
  const fallbackStatus = playoffFixture ? toMatchStatus(playoffFixture.status) : 'SCHEDULED';
  const fallbackHomeScore = numberOrUndefined(playoffFixture?.homeScore);
  const fallbackAwayScore = numberOrUndefined(playoffFixture?.awayScore);

  return {
    id: Number(row.id),
    stage: row.stage ? (String(row.stage) as TrackedMatch['stage']) : undefined,
    kickoffAt,
    providerFixtureId: stringOrUndefined(row.provider_fixture_id) ?? stringOrUndefined(playoffFixture?.providerFixtureId),
    publicStatus,
    status: normalizeMatchStatus(row.status) ?? provisionalStatus ?? fallbackStatus,
    homeTeam: stringOrUndefined(playoffFixture?.homeTeam) ?? String(row.home_team),
    awayTeam: stringOrUndefined(playoffFixture?.awayTeam) ?? String(row.away_team),
    homeTeamId: stringOrUndefined(playoffFixture?.homeTeamId) ?? stringOrUndefined(row.home_team_id),
    awayTeamId: stringOrUndefined(playoffFixture?.awayTeamId) ?? stringOrUndefined(row.away_team_id),
    homeTeamCode: stringOrUndefined(playoffFixture?.homeTeamCode) ?? stringOrUndefined(row.home_team_code),
    awayTeamCode: stringOrUndefined(playoffFixture?.awayTeamCode) ?? stringOrUndefined(row.away_team_code),
    homeScore: numberOrUndefined(row.home_score) ?? numberOrUndefined(row.provisional_home_score) ?? fallbackHomeScore,
    awayScore: numberOrUndefined(row.away_score) ?? numberOrUndefined(row.provisional_away_score) ?? fallbackAwayScore,
    minute: numberOrUndefined(row.minute),
    isFinal: isConfirmedFinalResult(row) || booleanValue(row.is_final),
    lastCheckedAt: stringOrUndefined(row.last_checked_at),
    nextCheckAt: stringOrUndefined(row.next_check_at),
    nextConfirmationCheckAt: stringOrUndefined(row.next_confirmation_check_at),
    needsReviewReason: stringOrUndefined(row.needs_review_reason),
    rawProviderStatus: stringOrUndefined(row.raw_provider_status),
    confirmationConfidence: stringOrUndefined(row.confirmation_confidence),
    confirmedHomeScore: numberOrUndefined(row.confirmed_home_score),
    confirmedAwayScore: numberOrUndefined(row.confirmed_away_score)
  };
}

function toMatchStatus(status: CanonicalPlayoffFixture['status']): MatchStatus {
  if (status === 'live') return 'LIVE';
  if (status === 'finished') return 'FINISHED';
  return 'SCHEDULED';
}

function normalizeMatchStatus(value: unknown): MatchStatus | undefined {
  if (!value) return undefined;
  const normalized = String(value).trim().toUpperCase();
  if (normalized === 'SCHEDULED' || normalized === 'LIVE' || normalized === 'HT' || normalized === 'ET' || normalized === 'PEN' || normalized === 'FINISHED' || normalized === 'POSTPONED' || normalized === 'SUSPENDED') {
    return normalized;
  }
  return undefined;
}

function normalizePublicStatus(value: unknown): PublicResultStatus | undefined {
  if (!value) return undefined;
  const normalized = String(value).trim().toUpperCase();
  if (normalized === 'SCHEDULED' || normalized === 'LIVE' || normalized === 'CONFIRMING' || normalized === 'CONFIRMED_FINAL' || normalized === 'NEEDS_REVIEW') {
    return normalized;
  }
  return undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function stringOrUndefined(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return String(value);
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}
