export function calculateRankMovement(previousRank?: number, currentRank?: number): number {
  if (!Number.isFinite(previousRank) || !Number.isFinite(currentRank)) return 0;
  return Math.trunc(previousRank) - Math.trunc(currentRank);
}
