import { randomUUID } from 'node:crypto';
import type { QueryableDatabase } from '../databaseAdapter.js';
import { rebuildLeaderboardAfterFinalResult } from './leaderboardRebuild.js';
import type { LeaderboardRepository } from './leaderboardRepository.js';
import { migrateResultPersistenceSchema } from './resultPersistenceSchema.js';
import type { LeaderboardRebuildResult, ResultUpdate, ResultsAgentRepository } from './resultTypes.js';

export type ManualResultDecidedAfter = 'FT' | 'AET' | 'PEN';

export interface ManualResultConfirmationInput {
  matchId: number;
  homeScore: number;
  awayScore: number;
  status?: 'CONFIRMED_FINAL';
  decidedAfter?: ManualResultDecidedAfter;
  penaltyWinnerTeamId?: string;
  penaltyWinnerTeamCode?: string;
  notes?: string;
  source?: string;
  confirmedBy?: string;
  scorers?: ManualResultScorerInput[];
  now?: Date;
}

export interface ManualResultScorerInput {
  playerName: string;
  teamName?: string;
  teamCode?: string;
  goals?: number;
}

interface NormalizedManualResultScorer {
  playerName: string;
  teamName?: string;
  teamCode?: string;
  goals: number;
}

export interface ManualResultConfirmationSummary {
  matchId: number;
  action: 'confirmed' | 'corrected' | 'idempotent';
  previousHomeScore?: number;
  previousAwayScore?: number;
  newHomeScore: number;
  newAwayScore: number;
  clearedNeedsReview: boolean;
  leaderboardRebuilt: boolean;
  playersProcessed: number;
  auditId: string;
  warnings: string[];
  rebuild?: LeaderboardRebuildResult;
}

export async function confirmManualResult(input: {
  db: QueryableDatabase;
  repository: ResultsAgentRepository;
  leaderboardRepository: LeaderboardRepository;
  confirmation: ManualResultConfirmationInput;
}): Promise<ManualResultConfirmationSummary> {
  const confirmation = normalizeManualInput(input.confirmation);
  await migrateResultPersistenceSchema(input.db);
  await assertMatchExists(input.db, confirmation.matchId);
  const normalizedScorers = normalizeScorers(confirmation.scorers);

  const previous = await input.repository.getMatchResult(confirmation.matchId);
  const sameConfirmedScore = previous?.publicStatus === 'CONFIRMED_FINAL' &&
    previous.isFinal &&
    previous.confirmedHomeScore === confirmation.homeScore &&
    previous.confirmedAwayScore === confirmation.awayScore;
  const action: ManualResultConfirmationSummary['action'] = sameConfirmedScore
    ? 'idempotent'
    : previous?.publicStatus === 'CONFIRMED_FINAL' && previous.isFinal
      ? 'corrected'
      : 'confirmed';

  const nowIso = (confirmation.now ?? new Date()).toISOString();
  const update: ResultUpdate = {
    matchId: confirmation.matchId,
    status: 'FINISHED',
    publicStatus: 'CONFIRMED_FINAL',
    homeScore: confirmation.homeScore,
    awayScore: confirmation.awayScore,
    isFinal: true,
    lastCheckedAt: nowIso,
    provider: confirmation.source,
    rawProviderStatus: confirmation.decidedAfter ? `manual:${confirmation.decidedAfter}` : 'manual',
    confirmedHomeScore: confirmation.homeScore,
    confirmedAwayScore: confirmation.awayScore,
    confirmedAt: nowIso,
    confirmationSource: confirmation.source,
    confirmationConfidence: 'manual',
    needsReviewReason: undefined,
    nextCheckAt: undefined,
    nextConfirmationCheckAt: undefined,
    providerResults: [{
      provider: confirmation.source,
      matchId: confirmation.matchId,
      status: 'FINISHED',
      homeScore: confirmation.homeScore,
      awayScore: confirmation.awayScore,
      isFinal: true,
      observedAt: nowIso,
      rawProviderStatus: confirmation.decidedAfter ? `manual:${confirmation.decidedAfter}` : 'manual',
      confidence: 'confirmed'
    }]
  };

  const { finalResultChanged } = await input.repository.saveResultUpdate(update);
  if (confirmation.scorers !== undefined) {
    await replaceManualScorersAndTopScorers(input.db, confirmation.matchId, normalizedScorers, nowIso);
  }
  const auditId = await writeManualCorrectionAudit(input.db, {
    id: `manual-correction-${randomUUID()}`,
    previous,
    confirmation,
    nowIso,
    scorers: normalizedScorers,
    scorersProvided: confirmation.scorers !== undefined
  });

  const existingLeaderboard = await input.leaderboardRepository.getLeaderboard();
  const shouldRebuild = finalResultChanged || existingLeaderboard.length === 0;
  let rebuild: LeaderboardRebuildResult | undefined;
  if (shouldRebuild) {
    const finalized = await input.repository.getFinalizedResults();
    rebuild = await rebuildLeaderboardAfterFinalResult({
      finalizedResults: finalized,
      now: confirmation.now ?? new Date(nowIso),
      previousEntries: existingLeaderboard
    });
    await input.leaderboardRepository.replaceLeaderboard(rebuild.entries, rebuild);
    await input.repository.markPointsRecalculated(confirmation.matchId, rebuild.recalculatedAt);
  }

  return {
    matchId: confirmation.matchId,
    action,
    previousHomeScore: previous?.confirmedHomeScore ?? previous?.homeScore,
    previousAwayScore: previous?.confirmedAwayScore ?? previous?.awayScore,
    newHomeScore: confirmation.homeScore,
    newAwayScore: confirmation.awayScore,
    clearedNeedsReview: previous?.publicStatus === 'NEEDS_REVIEW',
    leaderboardRebuilt: Boolean(rebuild),
    playersProcessed: rebuild?.playersProcessed ?? 0,
    auditId,
    warnings: rebuild?.warnings ?? [],
    rebuild
  };
}

function normalizeManualInput(input: ManualResultConfirmationInput): Required<Pick<ManualResultConfirmationInput, 'matchId' | 'homeScore' | 'awayScore' | 'source' | 'confirmedBy'>> & ManualResultConfirmationInput {
  if (!Number.isInteger(input.matchId) || input.matchId <= 0) throw new Error('matchId must be a positive integer.');
  if (!Number.isInteger(input.homeScore) || input.homeScore < 0) throw new Error('homeScore must be a non-negative integer.');
  if (!Number.isInteger(input.awayScore) || input.awayScore < 0) throw new Error('awayScore must be a non-negative integer.');
  if (input.status && input.status !== 'CONFIRMED_FINAL') throw new Error('Manual result status must be CONFIRMED_FINAL.');
  if (input.decidedAfter && !['FT', 'AET', 'PEN'].includes(input.decidedAfter)) throw new Error('decidedAfter must be FT, AET, or PEN.');
  return {
    ...input,
    source: input.source?.trim() || 'manual',
    confirmedBy: input.confirmedBy?.trim() || 'operator'
  };
}

async function assertMatchExists(db: QueryableDatabase, matchId: number): Promise<void> {
  const row = await db.one('SELECT id FROM matches WHERE id = ?', [matchId]);
  if (!row) throw new Error(`Match ${matchId} does not exist.`);
}

async function writeManualCorrectionAudit(db: QueryableDatabase, input: {
  id: string;
  previous?: ResultUpdate;
  confirmation: ReturnType<typeof normalizeManualInput>;
  nowIso: string;
  scorers: NormalizedManualResultScorer[];
  scorersProvided: boolean;
}): Promise<string> {
  await db.run(
    `INSERT INTO result_manual_corrections (
      id, match_id, previous_home_score, previous_away_score, new_home_score, new_away_score,
      previous_status, new_status, source, confirmed_by, decided_after, penalty_winner_team_id,
      penalty_winner_team_code, notes, scorers_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.confirmation.matchId,
      input.previous?.confirmedHomeScore ?? input.previous?.homeScore ?? null,
      input.previous?.confirmedAwayScore ?? input.previous?.awayScore ?? null,
      input.confirmation.homeScore,
      input.confirmation.awayScore,
      input.previous?.publicStatus ?? input.previous?.status ?? null,
      'CONFIRMED_FINAL',
      input.confirmation.source,
      input.confirmation.confirmedBy,
      input.confirmation.decidedAfter ?? null,
      input.confirmation.penaltyWinnerTeamId ?? null,
      input.confirmation.penaltyWinnerTeamCode ?? null,
      input.confirmation.notes ?? null,
      input.scorersProvided ? JSON.stringify(input.scorers) : null,
      input.nowIso
    ]
  );
  return input.id;
}

function normalizeScorers(input: ManualResultConfirmationInput['scorers']): NormalizedManualResultScorer[] {
  if (!input || input.length === 0) return [];
  return input.map((scorer, index) => normalizeScorer(scorer, index));
}

function normalizeScorer(input: ManualResultScorerInput, index: number): NormalizedManualResultScorer {
  const playerName = input.playerName?.trim();
  if (!playerName) throw new Error(`scorers[${index}].playerName is required.`);
  const teamName = input.teamName?.trim();
  const teamCode = input.teamCode?.trim();
  if (!teamName && !teamCode) throw new Error(`scorers[${index}].teamName or teamCode is required.`);
  const goals = input.goals ?? 1;
  if (!Number.isInteger(goals) || goals <= 0) throw new Error(`scorers[${index}].goals must be a positive integer.`);
  return { playerName, teamName: teamName || undefined, teamCode: teamCode || undefined, goals };
}

async function replaceManualScorersAndTopScorers(
  db: QueryableDatabase,
  matchId: number,
  scorers: NormalizedManualResultScorer[],
  nowIso: string
): Promise<void> {
  await migrateResultPersistenceSchema(db);
  await db.transaction(async (tx) => {
    const previousRows = await tx.all('SELECT * FROM result_manual_scorers WHERE match_id = ?', [matchId]);
    for (const row of previousRows) {
      const previousGoals = Number(row.goals ?? 0);
      if (previousGoals > 0) await adjustTopScorerTotal(tx, {
        playerName: String(row.player_name),
        teamId: row.team_id ? String(row.team_id) : undefined,
        delta: -previousGoals,
        nowIso
      });
    }

    await tx.run('DELETE FROM result_manual_scorers WHERE match_id = ?', [matchId]);
    for (const scorer of scorers) {
      const team = await resolveTeam(tx, scorer);
      const id = `${matchId}-${slug(scorer.playerName)}-${team?.teamId ?? team?.teamCode ?? 'unknown'}-${scorer.goals}`;
      await tx.run(
        `INSERT INTO result_manual_scorers (id, match_id, player_name, team_id, team_code, goals, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, matchId, scorer.playerName, team?.teamId ?? null, team?.teamCode ?? scorer.teamCode ?? null, scorer.goals, nowIso]
      );
      await adjustTopScorerTotal(tx, {
        playerName: scorer.playerName,
        teamId: team?.teamId,
        delta: scorer.goals,
        nowIso
      });
    }
    await resequenceTopScorers(tx, nowIso);
  });
}

async function resolveTeam(db: QueryableDatabase, scorer: NormalizedManualResultScorer): Promise<{ teamId?: string; teamCode?: string }> {
  const code = scorer.teamCode?.trim();
  const name = scorer.teamName?.trim();
  const row = await db.one(
    `SELECT id, code FROM teams
     WHERE (? IS NOT NULL AND code = ?)
        OR (? IS NOT NULL AND id = ?)
        OR (? IS NOT NULL AND name = ?)
        OR (? IS NOT NULL AND name_et = ?)
     LIMIT 1`,
    [code ?? null, code ?? null, code ?? null, code ?? null, name ?? null, name ?? null, name ?? null, name ?? null]
  );
  if (!row) throw new Error(`Unable to resolve scorer team "${code ?? name ?? 'unknown'}".`);
  const team: { teamId?: string; teamCode?: string } = {};
  if (row.id !== undefined && row.id !== null && String(row.id)) team.teamId = String(row.id);
  if (row.code !== undefined && row.code !== null && String(row.code)) team.teamCode = String(row.code);
  else if (code) team.teamCode = code;
  return team;
}

async function adjustTopScorerTotal(db: QueryableDatabase, input: {
  playerName: string;
  teamId?: string;
  delta: number;
  nowIso: string;
}): Promise<void> {
  const id = scorerRowId(input.playerName, input.teamId);
  const existing = await db.one('SELECT * FROM top_scorer_standings WHERE id = ?', [id]);
  const currentGoals = Number(existing?.goals ?? 0);
  const nextGoals = currentGoals + input.delta;
  if (nextGoals <= 0) {
    await db.run('DELETE FROM top_scorer_standings WHERE id = ?', [id]);
    return;
  }
  await db.run(
    `INSERT INTO top_scorer_standings (id, rank, player_name, team_id, goals, assists, minutes_played, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET goals = ?, updated_at = ?`,
    [
      id,
      Number(existing?.rank ?? 999),
      input.playerName,
      input.teamId ?? null,
      nextGoals,
      Number(existing?.assists ?? 0),
      existing?.minutes_played === undefined || existing?.minutes_played === null ? null : Number(existing.minutes_played),
      input.nowIso,
      nextGoals,
      input.nowIso
    ]
  );
}

async function resequenceTopScorers(db: QueryableDatabase, nowIso: string): Promise<void> {
  const rows = await db.all('SELECT id FROM top_scorer_standings ORDER BY goals DESC, player_name ASC, id ASC');
  for (const [index, row] of rows.entries()) {
    await db.run('UPDATE top_scorer_standings SET rank = ?, updated_at = ? WHERE id = ?', [index + 1, nowIso, String(row.id)]);
  }
}

function scorerRowId(playerName: string, teamId?: string): string {
  return `${slug(playerName)}-${teamId ?? 'unknown'}`;
}

function slug(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
