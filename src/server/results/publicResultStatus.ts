import type { PublicResultStatus } from './resultTypes.js';
import { isConfirmedFinalResult } from './finalizedResultState.js';

export interface PublicResultStatusLike {
  status?: unknown;
  provisionalStatus?: unknown;
  provisional_status?: unknown;
  publicStatus?: unknown;
  public_status?: unknown;
  confirmationConfidence?: unknown;
  confirmation_confidence?: unknown;
  needsReviewReason?: unknown;
  needs_review_reason?: unknown;
  nextConfirmationCheckAt?: unknown;
  next_confirmation_check_at?: unknown;
  rawProviderStatus?: unknown;
  raw_provider_status?: unknown;
  isFinal?: unknown;
  is_final?: unknown;
  confirmedHomeScore?: unknown;
  confirmed_home_score?: unknown;
  confirmedAwayScore?: unknown;
  confirmed_away_score?: unknown;
}

export function derivePublicResultStatus(row: PublicResultStatusLike): PublicResultStatus {
  if (isConfirmedFinalResult(row)) return 'CONFIRMED_FINAL';

  const status = normalizeProviderStatusToken(row.status);
  const provisionalStatus = normalizeProviderStatusToken(row.provisionalStatus ?? row.provisional_status);
  const publicStatus = normalizeProviderStatusToken(row.publicStatus ?? row.public_status);
  const rawProviderStatus = normalizeProviderStatusToken(row.rawProviderStatus ?? row.raw_provider_status);
  const confirmationConfidence = String(row.confirmationConfidence ?? row.confirmation_confidence ?? '').toUpperCase();
  const needsReviewReason = String(row.needsReviewReason ?? row.needs_review_reason ?? '').trim();
  const nextConfirmationCheckAt = String(row.nextConfirmationCheckAt ?? row.next_confirmation_check_at ?? '').trim();

  if ([status, provisionalStatus, publicStatus, rawProviderStatus].some(isActiveProviderStatus)) return 'LIVE';
  if (needsReviewReason || publicStatus === 'NEEDS_REVIEW') return 'NEEDS_REVIEW';
  if (
    status === 'FINISHED' ||
    provisionalStatus === 'FINISHED' ||
    publicStatus === 'CONFIRMING' ||
    confirmationConfidence === 'MANUAL' ||
    Boolean(nextConfirmationCheckAt)
  ) {
    return 'CONFIRMING';
  }
  return 'SCHEDULED';
}

function normalizeProviderStatusToken(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().replace(/[-\s]/g, '_');
}

function isActiveProviderStatus(value: string): boolean {
  return [
    'LIVE',
    'IN_PLAY',
    'FIRST_HALF',
    'SECOND_HALF',
    '1H',
    '2H',
    'HT',
    'HALF_TIME',
    'HALFTIME',
    'PAUSED',
    'ET',
    'EXTRA_TIME',
    'PEN',
    'PENALTIES',
    'PENALTY_SHOOTOUT',
    'PENALTY_IN_PROGRESS',
    'SUSPENDED',
    'INTERRUPTED'
  ].includes(value);
}
