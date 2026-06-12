import type { LeaderboardEntry } from './predictionRepository.js';
import { predictionRepository } from './predictionRepository.js';

export function buildCanonicalPublicLeaderboardEntries(persistedEntries: LeaderboardEntry[] = []): LeaderboardEntry[] {
  const canonicalOrder = predictionRepository.getLeaderboard();
  const canonicalRows = canonicalOrder.length > 0
    ? canonicalOrder
    : predictionRepository.getPlayers().map((player, index) => zeroLeaderboardEntry(player.id, index + 1));
  const persistedByPlayerId = new Map(persistedEntries.map((entry) => [entry.playerId, entry]));

  return canonicalRows
    .map((seedEntry, index) => persistedByPlayerId.get(seedEntry.playerId) ?? zeroLeaderboardEntry(seedEntry.playerId, index + 1))
    .sort((a, b) => a.rank - b.rank || a.playerId.localeCompare(b.playerId));
}

function zeroLeaderboardEntry(playerId: string, rank: number): LeaderboardEntry {
  return {
    playerId,
    rank,
    points: 0,
    exactScores: 0,
    correctResults: 0,
    hitRate: 0,
    matchesScored: 0,
    matchPoints: 0,
    groupBonusPoints: 0,
    playoffBonusPoints: 0,
    topScorerBonusPoints: 0,
    totalPoints: 0,
    lastUpdatedAt: ''
  };
}
