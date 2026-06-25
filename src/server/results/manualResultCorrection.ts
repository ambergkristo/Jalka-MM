import { randomUUID } from 'node:crypto';
import type { QueryableDatabase } from '../databaseAdapter.js';
import { rebuildLeaderboardAfterFinalResult } from './leaderboardRebuild.js';
import type { LeaderboardRepository } from './leaderboardRepository.js';
import { migrateResultPersistenceSchema } from './resultPersistenceSchema.js';
import { syncConfirmedScorersForMatch } from './topScorerStandings.js';
import { buildConfiguredActualScoringState } from './scoringState.js';
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
    await syncConfirmedScorersForMatch(input.db, confirmation.matchId, normalizedScorers, nowIso);
  }
  const auditId = await writeManualCorrectionAudit(input.db, {
    id: `manual-correction-${randomUUID()}`,
    previous,
    confirmation,
    nowIso,
    scorers: normalizedScorers,
    scorersProvided: confirmation.scorers !== undefined
  });

  let rebuild: LeaderboardRebuildResult | undefined;
  if (finalResultChanged || normalizedScorers.length > 0 || (await input.leaderboardRepository.getLeaderboard()).length === 0) {
    rebuild = input.repository.refreshDerivedTournamentState
      ? await input.repository.refreshDerivedTournamentState(nowIso)
      : undefined;
    if (!rebuild) {
      const existingLeaderboard = await input.leaderboardRepository.getLeaderboard();
      const finalized = await input.repository.getFinalizedResults();
      const actualScoringState = await buildConfiguredActualScoringState(input.db, new Date());
      rebuild = await rebuildLeaderboardAfterFinalResult({
        finalizedResults: finalized,
        now: confirmation.now ?? new Date(nowIso),
        previousEntries: existingLeaderboard,
        actualGroupStandings: actualScoringState.actualGroupStandings,
        actualKnockoutResults: actualScoringState.actualKnockoutResults,
        actualTopScorers: actualScoringState.actualTopScorers
      });
      await input.leaderboardRepository.replaceLeaderboard(rebuild.entries, rebuild);
      await input.repository.markPointsRecalculated(confirmation.matchId, rebuild.recalculatedAt);
    }
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
