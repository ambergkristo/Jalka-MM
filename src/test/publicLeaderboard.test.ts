import { describe, expect, it } from 'vitest';
import { buildCanonicalPublicLeaderboardEntries } from '../domain/publicLeaderboard.js';
import { predictionRepository, type LeaderboardEntry } from '../domain/predictionRepository.js';

function row(input: Partial<LeaderboardEntry> & Pick<LeaderboardEntry, 'playerId'>): LeaderboardEntry {
  return {
    playerId: input.playerId,
    rank: input.rank ?? 0,
    points: input.points ?? 0,
    exactScores: input.exactScores ?? 0,
    correctResults: input.correctResults ?? 0,
    hitRate: input.hitRate ?? 0,
    matchesScored: input.matchesScored ?? 0,
    matchPoints: input.matchPoints ?? input.points ?? 0,
    groupBonusPoints: input.groupBonusPoints ?? 0,
    playoffBonusPoints: input.playoffBonusPoints ?? 0,
    topScorerBonusPoints: input.topScorerBonusPoints ?? 0,
    totalPoints: input.totalPoints ?? input.points ?? 0,
    previousRank: input.previousRank,
    lastUpdatedAt: input.lastUpdatedAt ?? ''
  };
}

describe('public leaderboard projection', () => {
  it('expands partial persisted rows to the full imported player set', () => {
    const persisted = predictionRepository.getLeaderboard().slice(0, 24);
    const projected = buildCanonicalPublicLeaderboardEntries(persisted);

    expect(projected).toHaveLength(109);
    expect(projected.every((entry) => predictionRepository.getPlayerById(entry.playerId))).toBe(true);
    expect(projected.some((entry) => entry.points === 0)).toBe(true);
  });

  it('sorts scored players above zero rows and recalculates rank', () => {
    const players = predictionRepository.getPlayers();
    const projected = buildCanonicalPublicLeaderboardEntries([
      row({ playerId: players[0].id, rank: 1, points: 0, exactScores: 0, correctResults: 0, hitRate: 0 }),
      row({ playerId: players[1].id, rank: 99, points: 12, exactScores: 2, correctResults: 4, hitRate: 0.8 }),
      row({ playerId: players[2].id, rank: 2, points: 12, exactScores: 1, correctResults: 5, hitRate: 0.7 })
    ]);

    expect(projected[0]).toMatchObject({
      playerId: players[1].id,
      points: 12,
      exactScores: 2,
      rank: 1
    });
    expect(projected[1]).toMatchObject({
      playerId: players[2].id,
      points: 12,
      exactScores: 1,
      rank: 2
    });
    expect(projected.find((entry) => entry.playerId === players[0].id)).toMatchObject({
      points: 0,
      rank: 3
    });
  });

  it('keeps all canonical players visible even when persisted rows are sparse', () => {
    const players = predictionRepository.getPlayers();
    const projected = buildCanonicalPublicLeaderboardEntries([
      row({ playerId: players[0].id, rank: 1, points: 12, exactScores: 1, correctResults: 2, hitRate: 0.5 })
    ]);

    expect(projected).toHaveLength(109);
    expect(projected.find((entry) => entry.playerId === players[108].id)).toMatchObject({
      points: 0,
      exactScores: 0,
      correctResults: 0
    });
  });

  it('ignores stale persisted rank values when ordering rows', () => {
    const players = predictionRepository.getPlayers();
    const projected = buildCanonicalPublicLeaderboardEntries([
      row({ playerId: players[0].id, rank: 1, points: 0, exactScores: 0, correctResults: 0, hitRate: 0 }),
      row({ playerId: players[1].id, rank: 2, points: 12, exactScores: 0, correctResults: 0, hitRate: 0 }),
      row({ playerId: players[2].id, rank: 3, points: 12, exactScores: 0, correctResults: 0, hitRate: 0 })
    ]);

    expect(new Set(projected.slice(0, 2).map((entry) => entry.playerId))).toEqual(new Set([players[1].id, players[2].id]));
    expect(projected[0].rank).toBe(1);
    expect(projected[1].rank).toBe(1);
    expect(projected.find((entry) => entry.playerId === players[0].id)?.rank).toBeGreaterThan(1);
  });
});
