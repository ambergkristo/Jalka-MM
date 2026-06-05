import { describe, expect, it } from 'vitest';
import { decideResultConsensus, toPublicResult, type ConsensusDecision } from '../server/results/resultConsensus.js';
import type { ProviderResultObservation, ResultUpdate } from '../server/results/resultTypes.js';

const now = new Date('2026-06-15T18:00:00.000Z');

describe('result consensus', () => {
  it('keeps first single-provider final result provisional', () => {
    const decision = decide(providerFinal('sportmonks', now));

    expect(decision.confirmed).toBe(false);
    expect(decision.pending).toBe(true);
    expect(decision.update.publicStatus).toBe('CONFIRMING');
    expect(decision.update.isFinal).toBe(false);
    expect(decision.update.provisionalHomeScore).toBe(2);
    expect(decision.update.nextConfirmationCheckAt).toBe('2026-06-15T18:10:00.000Z');
  });

  it('confirms same-provider repeated final score after fallback delay', () => {
    const previous = providerFinal('sportmonks', new Date('2026-06-15T18:00:00.000Z'));
    const current = providerFinal('sportmonks', new Date('2026-06-15T18:11:00.000Z'));
    const decision = decide(current, { previousObservations: [previous], now: new Date(current.observedAt) });

    expect(decision.confirmed).toBe(true);
    expect(decision.update.publicStatus).toBe('CONFIRMED_FINAL');
    expect(decision.update.isFinal).toBe(true);
    expect(decision.update.confirmationConfidence).toBe('provider-repeat');
  });

  it('does not confirm same-provider repeated final before fallback delay', () => {
    const previous = providerFinal('sportmonks', new Date('2026-06-15T18:00:00.000Z'));
    const current = providerFinal('sportmonks', new Date('2026-06-15T18:05:00.000Z'));
    const decision = decide(current, { previousObservations: [previous], now: new Date(current.observedAt) });

    expect(decision.confirmed).toBe(false);
    expect(decision.pending).toBe(true);
  });

  it('confirms immediately when two providers agree on final score', () => {
    const previous = providerFinal('api-football', now);
    const current = providerFinal('sportmonks', now);
    const decision = decide(current, { previousObservations: [previous] });

    expect(decision.confirmed).toBe(true);
    expect(decision.update.confirmationConfidence).toBe('provider-agreement');
    expect(decision.update.confirmationSource).toBe('api-football+sportmonks');
  });

  it('sets needsReview when providers disagree', () => {
    const previous = providerFinal('api-football', now, { homeScore: 2, awayScore: 1 });
    const current = providerFinal('sportmonks', now, { homeScore: 3, awayScore: 1 });
    const decision = decide(current, { previousObservations: [previous] });

    expect(decision.confirmed).toBe(false);
    expect(decision.needsReview).toBe(true);
    expect(decision.update.publicStatus).toBe('NEEDS_REVIEW');
    expect(decision.update.needsReviewReason).toContain('disagree');
  });

  it('never confirms live or non-final observations', () => {
    const decision = decide({
      ...providerFinal('sportmonks', now),
      status: 'LIVE',
      isFinal: false
    });

    expect(decision.confirmed).toBe(false);
    expect(decision.pending).toBe(false);
    expect(decision.update.publicStatus).toBe('LIVE');
  });

  it('hides provisional final scores from public result mapping', () => {
    const provisional = decide(providerFinal('sportmonks', now)).update;
    expect(toPublicResult(provisional)).toMatchObject({
      publicStatus: 'CONFIRMING',
      homeScore: undefined,
      awayScore: undefined,
      statusLabel: 'Kinnitamisel'
    });
  });

  it('shows only confirmed final scores publicly', () => {
    const confirmed: ResultUpdate = {
      matchId: 4,
      status: 'FINISHED',
      publicStatus: 'CONFIRMED_FINAL',
      homeScore: 2,
      awayScore: 1,
      confirmedHomeScore: 2,
      confirmedAwayScore: 1,
      isFinal: true,
      lastCheckedAt: now.toISOString(),
      provider: 'sportmonks'
    };

    expect(toPublicResult(confirmed)).toMatchObject({
      publicStatus: 'CONFIRMED_FINAL',
      homeScore: 2,
      awayScore: 1,
      statusLabel: 'Lõppenud'
    });
  });
});

function decide(observation: ProviderResultObservation, options: {
  previousObservations?: ProviderResultObservation[];
  previousResult?: ResultUpdate;
  now?: Date;
} = {}): ConsensusDecision {
  return decideResultConsensus({
    observation,
    previousObservations: options.previousObservations,
    previousResult: options.previousResult,
    now: options.now ?? now,
    confirmationDelayMs: 10 * 60_000
  });
}

function providerFinal(provider: string, observedAt: Date, score: { homeScore: number; awayScore: number } = { homeScore: 2, awayScore: 1 }): ProviderResultObservation {
  return {
    provider,
    matchId: 4,
    status: 'FINISHED',
    homeScore: score.homeScore,
    awayScore: score.awayScore,
    isFinal: true,
    observedAt: observedAt.toISOString(),
    rawProviderStatus: 'FT',
    confidence: 'high'
  };
}
