export const CONFIRMED_FINAL_RESULT_SQL = `
  (
    (public_status = 'CONFIRMED_FINAL' AND is_final = 1)
    OR (confirmed_home_score IS NOT NULL AND confirmed_away_score IS NOT NULL)
  )
`;

export interface ConfirmedFinalResultLike {
  publicStatus?: unknown;
  isFinal?: unknown;
  confirmedHomeScore?: unknown;
  confirmedAwayScore?: unknown;
  public_status?: unknown;
  is_final?: unknown;
  confirmed_home_score?: unknown;
  confirmed_away_score?: unknown;
}

export function isConfirmedFinalResult(row: ConfirmedFinalResultLike): boolean {
  const publicStatus = String(row.publicStatus ?? row.public_status ?? '').toUpperCase();
  const isFinal = Number(row.isFinal ?? row.is_final ?? 0) === 1;
  const confirmedHomeScore = toNumber(row.confirmedHomeScore ?? row.confirmed_home_score);
  const confirmedAwayScore = toNumber(row.confirmedAwayScore ?? row.confirmed_away_score);
  return (isFinal && publicStatus === 'CONFIRMED_FINAL') || (confirmedHomeScore !== undefined && confirmedAwayScore !== undefined);
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
