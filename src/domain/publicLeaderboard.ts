import type { LeaderboardEntry } from './predictionRepository.js';
import { predictionRepository } from './predictionRepository.js';

export function buildCanonicalPublicLeaderboardEntries(persistedEntries: LeaderboardEntry[] = []): LeaderboardEntry[] {
  const players = predictionRepository.getPlayers();
  const persistedByPlayerId = new Map(persistedEntries.map((entry) => [entry.playerId, entry]));
  const playerNameById = new Map(players.map((player) => [player.id, player.name]));

  const rows = players.map((player) => {
    const persisted = persistedByPlayerId.get(player.id);
    return {
      playerId: player.id,
      rank: 0,
      points: persisted?.points ?? 0,
      exactScores: persisted?.exactScores ?? 0,
      correctResults: persisted?.correctResults ?? 0,
      hitRate: persisted?.hitRate ?? 0,
      matchesScored: persisted?.matchesScored ?? 0,
      matchPoints: persisted?.matchPoints ?? persisted?.points ?? 0,
      groupBonusPoints: persisted?.groupBonusPoints ?? 0,
      playoffBonusPoints: persisted?.playoffBonusPoints ?? 0,
      topScorerBonusPoints: persisted?.topScorerBonusPoints ?? 0,
      totalPoints: persisted?.totalPoints ?? persisted?.points ?? 0,
      previousRank: persisted?.previousRank ?? persisted?.rank,
      lastUpdatedAt: persisted?.lastUpdatedAt ?? ''
    };
  });

  rows.sort((a, b) => compareLeaderboardRows(a, b, playerNameById));
  return assignCompetitionRanks(rows);
}

function compareLeaderboardRows(
  a: LeaderboardEntry,
  b: LeaderboardEntry,
  playerNameById: Map<string, string>
): number {
  return (
    b.points - a.points ||
    b.exactScores - a.exactScores ||
    b.correctResults - a.correctResults ||
    b.hitRate - a.hitRate ||
    (playerNameById.get(a.playerId) ?? a.playerId).localeCompare(playerNameById.get(b.playerId) ?? b.playerId, 'et')
  );
}

function assignCompetitionRanks(rows: LeaderboardEntry[]): LeaderboardEntry[] {
  let currentRank = 0;
  let previousKey = '';
  return rows.map((row, index) => {
    const key = `${row.points}|${row.exactScores}|${row.correctResults}|${row.hitRate}`;
    if (key !== previousKey) currentRank = index + 1;
    previousKey = key;
    return { ...row, rank: currentRank };
  });
}
