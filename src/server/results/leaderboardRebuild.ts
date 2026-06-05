import type { LeaderboardRebuildResult, ResultUpdate } from './resultTypes.js';

export async function rebuildLeaderboardAfterFinalResult(input: {
  finalizedResults: ResultUpdate[];
  now: Date;
}): Promise<LeaderboardRebuildResult> {
  // TODO: Replace this deterministic skeleton with Excel-derived predictions and saved LeaderboardEntry writes.
  return {
    recalculatedAt: input.now.toISOString(),
    playersProcessed: 10,
    matchesProcessed: input.finalizedResults.length,
    changedEntries: input.finalizedResults.length > 0 ? 5 : 0
  };
}
