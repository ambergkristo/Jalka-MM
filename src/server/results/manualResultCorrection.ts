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
  now?: Date;
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
  const auditId = await writeManualCorrectionAudit(input.db, {
    id: `manual-correction-${randomUUID()}`,
    previous,
    confirmation,
    nowIso
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
}): Promise<string> {
  await db.run(
    `INSERT INTO result_manual_corrections (
      id, match_id, previous_home_score, previous_away_score, new_home_score, new_away_score,
      previous_status, new_status, source, confirmed_by, decided_after, penalty_winner_team_id,
      penalty_winner_team_code, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      input.nowIso
    ]
  );
  return input.id;
}
