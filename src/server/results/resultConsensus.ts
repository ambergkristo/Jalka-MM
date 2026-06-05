import type { MatchStatus, ProviderResultObservation, PublicResultStatus, ResultUpdate } from './resultTypes.js';

const CONFIRMATION_DELAY_MS = 10 * 60_000;
const REVIEW_RECHECK_DELAY_MS = 15 * 60_000;

export interface ConsensusDecision {
  update: ResultUpdate;
  confirmed: boolean;
  needsReview: boolean;
  pending: boolean;
  warnings: string[];
}

export function toProviderResultObservation(update: ResultUpdate): ProviderResultObservation {
  return {
    provider: update.provider,
    matchId: update.matchId,
    status: update.status,
    homeScore: update.homeScore,
    awayScore: update.awayScore,
    minute: update.minute,
    isFinal: update.isFinal,
    observedAt: update.lastCheckedAt,
    providerFixtureId: update.providerMatchId,
    rawProviderStatus: update.rawProviderStatus,
    confidence: update.isFinal ? 'high' : 'medium',
    providerUpdatedAt: update.providerUpdatedAt,
    warnings: update.warning ? [update.warning] : []
  };
}

export function decideResultConsensus(input: {
  observation: ProviderResultObservation;
  previousResult?: ResultUpdate;
  previousObservations?: ProviderResultObservation[];
  now: Date;
  confirmationDelayMs?: number;
}): ConsensusDecision {
  const nowIso = input.now.toISOString();
  const confirmationDelayMs = input.confirmationDelayMs ?? CONFIRMATION_DELAY_MS;
  const observations = [...(input.previousObservations ?? []), input.observation];
  const base = baseUpdateFromObservation(input.observation, input.previousResult, nowIso);

  if (!input.observation.isFinal) {
    return {
      update: {
        ...base,
        isFinal: false,
        publicStatus: publicStatusForNonFinal(input.observation.status),
        nextConfirmationCheckAt: undefined,
        providerResults: observations
      },
      confirmed: false,
      needsReview: false,
      pending: false,
      warnings: []
    };
  }

  if (!hasScore(input.observation)) {
    return pendingDecision({
      base,
      observations,
      now: input.now,
      confirmationDelayMs,
      warning: `Final observation from ${input.observation.provider} for match ${input.observation.matchId} did not include a complete score.`
    });
  }

  const finalObservations = observations.filter((observation) => observation.isFinal && hasScore(observation));
  if (providersDisagree(finalObservations)) {
    const needsReviewReason = `Provider final scores disagree for match ${input.observation.matchId}.`;
    return {
      update: {
        ...base,
        isFinal: false,
        publicStatus: 'NEEDS_REVIEW',
        provisionalHomeScore: input.observation.homeScore,
        provisionalAwayScore: input.observation.awayScore,
        provisionalStatus: input.observation.status,
        needsReviewReason,
        nextConfirmationCheckAt: new Date(input.now.getTime() + REVIEW_RECHECK_DELAY_MS).toISOString(),
        nextCheckAt: new Date(input.now.getTime() + REVIEW_RECHECK_DELAY_MS).toISOString(),
        providerResults: observations
      },
      confirmed: false,
      needsReview: true,
      pending: false,
      warnings: [needsReviewReason]
    };
  }

  const agreedByProviders = findTwoProviderAgreement(finalObservations);
  if (agreedByProviders) {
    return confirmedDecision({
      base,
      observation: input.observation,
      observations,
      nowIso,
      confidence: 'provider-agreement',
      source: agreedByProviders.map((observation) => observation.provider).sort().join('+')
    });
  }

  if (sameProviderRepeatedAfterDelay(input.observation, finalObservations, confirmationDelayMs)) {
    return confirmedDecision({
      base,
      observation: input.observation,
      observations,
      nowIso,
      confidence: 'provider-repeat',
      source: input.observation.provider
    });
  }

  return pendingDecision({ base, observations, now: input.now, confirmationDelayMs });
}

export function toPublicResult(update: ResultUpdate): {
  matchId: number;
  publicStatus: PublicResultStatus;
  homeScore?: number;
  awayScore?: number;
  statusLabel: 'Algamas' | 'Käimas' | 'Kinnitamisel' | 'Lõppenud';
} {
  const publicStatus = update.publicStatus ?? (update.isFinal ? 'CONFIRMED_FINAL' : publicStatusForNonFinal(update.status));
  const scoreVisible = publicStatus === 'CONFIRMED_FINAL';
  return {
    matchId: update.matchId,
    publicStatus,
    homeScore: scoreVisible ? update.confirmedHomeScore ?? update.homeScore : undefined,
    awayScore: scoreVisible ? update.confirmedAwayScore ?? update.awayScore : undefined,
    statusLabel: statusLabel(publicStatus)
  };
}

function baseUpdateFromObservation(observation: ProviderResultObservation, previousResult: ResultUpdate | undefined, nowIso: string): ResultUpdate {
  return {
    matchId: observation.matchId,
    providerMatchId: observation.providerFixtureId ?? previousResult?.providerMatchId,
    status: observation.status,
    homeScore: observation.homeScore,
    awayScore: observation.awayScore,
    minute: observation.minute,
    isFinal: false,
    lastCheckedAt: observation.observedAt,
    provider: observation.provider,
    rawProviderStatus: observation.rawProviderStatus,
    providerUpdatedAt: observation.providerUpdatedAt,
    confirmedHomeScore: previousResult?.confirmedHomeScore,
    confirmedAwayScore: previousResult?.confirmedAwayScore,
    confirmedAt: previousResult?.confirmedAt,
    confirmationSource: previousResult?.confirmationSource,
    confirmationConfidence: previousResult?.confirmationConfidence,
    lastProviderCheckAt: nowIso,
    warning: observation.warnings?.[0]
  };
}

function pendingDecision(input: {
  base: ResultUpdate;
  observations: ProviderResultObservation[];
  now: Date;
  confirmationDelayMs?: number;
  warning?: string;
}): ConsensusDecision {
  const nextConfirmationCheckAt = new Date(input.now.getTime() + (input.confirmationDelayMs ?? CONFIRMATION_DELAY_MS)).toISOString();
  const warnings = input.warning ? [input.warning] : [`Final result for match ${input.base.matchId} is pending confirmation before public scoring.`];
  return {
    update: {
      ...input.base,
      isFinal: false,
      publicStatus: 'CONFIRMING',
      provisionalHomeScore: input.base.homeScore,
      provisionalAwayScore: input.base.awayScore,
      provisionalStatus: input.base.status,
      nextConfirmationCheckAt,
      nextCheckAt: nextConfirmationCheckAt,
      providerResults: input.observations,
      warning: input.base.warning ?? input.warning
    },
    confirmed: false,
    needsReview: false,
    pending: true,
    warnings
  };
}

function confirmedDecision(input: {
  base: ResultUpdate;
  observation: ProviderResultObservation;
  observations: ProviderResultObservation[];
  nowIso: string;
  confidence: 'provider-repeat' | 'provider-agreement';
  source: string;
}): ConsensusDecision {
  return {
    update: {
      ...input.base,
      status: 'FINISHED',
      isFinal: true,
      publicStatus: 'CONFIRMED_FINAL',
      homeScore: input.observation.homeScore,
      awayScore: input.observation.awayScore,
      confirmedHomeScore: input.observation.homeScore,
      confirmedAwayScore: input.observation.awayScore,
      confirmedAt: input.nowIso,
      confirmationSource: input.source,
      confirmationConfidence: input.confidence,
      needsReviewReason: undefined,
      nextConfirmationCheckAt: undefined,
      nextCheckAt: undefined,
      providerResults: input.observations
    },
    confirmed: true,
    needsReview: false,
    pending: false,
    warnings: []
  };
}

function publicStatusForNonFinal(status: MatchStatus): PublicResultStatus {
  if (status === 'LIVE' || status === 'HT' || status === 'ET' || status === 'PEN' || status === 'SUSPENDED') return 'LIVE';
  return 'SCHEDULED';
}

function statusLabel(status: PublicResultStatus): 'Algamas' | 'Käimas' | 'Kinnitamisel' | 'Lõppenud' {
  if (status === 'CONFIRMED_FINAL') return 'Lõppenud';
  if (status === 'CONFIRMING' || status === 'NEEDS_REVIEW') return 'Kinnitamisel';
  if (status === 'LIVE') return 'Käimas';
  return 'Algamas';
}

function hasScore(observation: ProviderResultObservation): observation is ProviderResultObservation & { homeScore: number; awayScore: number } {
  return typeof observation.homeScore === 'number' && typeof observation.awayScore === 'number';
}

function scoreKey(observation: ProviderResultObservation): string {
  return `${observation.homeScore}-${observation.awayScore}`;
}

function findTwoProviderAgreement(observations: ProviderResultObservation[]): ProviderResultObservation[] | undefined {
  const byScore = new Map<string, ProviderResultObservation[]>();
  for (const observation of observations) {
    const rows = byScore.get(scoreKey(observation)) ?? [];
    rows.push(observation);
    byScore.set(scoreKey(observation), rows);
  }
  return [...byScore.values()].find((rows) => new Set(rows.map((row) => row.provider)).size >= 2);
}

function providersDisagree(observations: ProviderResultObservation[]): boolean {
  const providers = new Set(observations.map((observation) => observation.provider));
  const scores = new Set(observations.map(scoreKey));
  return providers.size >= 2 && scores.size >= 2;
}

function sameProviderRepeatedAfterDelay(current: ProviderResultObservation, observations: ProviderResultObservation[], delayMs: number): boolean {
  const currentObservedAt = Date.parse(current.observedAt);
  return observations.some((observation) => {
    if (observation === current) return false;
    return observation.provider === current.provider &&
      scoreKey(observation) === scoreKey(current) &&
      Math.abs(currentObservedAt - Date.parse(observation.observedAt)) >= delayMs;
  });
}
