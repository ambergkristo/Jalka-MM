import { describe, expect, it } from 'vitest';
import type { LeaderboardEntry, Player } from '../domain/predictionRepository.js';
import { buildPredictionLeagueInsights } from '../server/results/predictionLeagueInsights.js';

const players: Player[] = [
  { id: 'alpha', name: 'Alpha Player' },
  { id: 'beta', name: 'Beta Player' },
  { id: 'gamma', name: 'Gamma Player' }
];

const repository = {
  getPlayers: () => players
};

function entry(input: Partial<LeaderboardEntry> & Pick<LeaderboardEntry, 'playerId' | 'rank' | 'points'>): LeaderboardEntry {
  return {
    playerId: input.playerId,
    rank: input.rank,
    points: input.points,
    exactScores: input.exactScores ?? 0,
    correctResults: input.correctResults ?? 0,
    hitRate: input.hitRate ?? 0,
    matchesScored: input.matchesScored ?? 0,
    matchPoints: input.matchPoints ?? input.points,
    groupBonusPoints: input.groupBonusPoints ?? 0,
    playoffBonusPoints: input.playoffBonusPoints ?? 0,
    topScorerBonusPoints: input.topScorerBonusPoints ?? 0,
    totalPoints: input.totalPoints ?? input.points,
    previousRank: input.previousRank,
    lastUpdatedAt: input.lastUpdatedAt ?? '2026-06-13T20:00:00.000Z'
  };
}

function card(insights: ReturnType<typeof buildPredictionLeagueInsights>, id: string) {
  return [...insights.statistics.cards, ...insights.records.cards].find((item) => item.id === id);
}

describe('prediction league insights', () => {
  it('derives every displayed metric from the canonical current leaderboard only', () => {
    const insights = buildPredictionLeagueInsights({
      repository,
      leaderboardEntries: [
        entry({ playerId: 'beta', rank: 1, points: 16, exactScores: 2, correctResults: 3, hitRate: 1, matchesScored: 3 }),
        entry({ playerId: 'alpha', rank: 2, points: 12, exactScores: 1, correctResults: 2, hitRate: 2 / 3, matchesScored: 3 }),
        entry({ playerId: 'gamma', rank: 3, points: 0, exactScores: 0, correctResults: 0, hitRate: 0, matchesScored: 3 })
      ]
    });

    expect(card(insights, 'player-count')).toMatchObject({ value: '3' });
    expect(card(insights, 'average-points')).toMatchObject({ value: '9,33' });
    expect(card(insights, 'total-exact-scores')).toMatchObject({ value: '3' });
    expect(card(insights, 'current-leader')).toMatchObject({ subject: 'Beta Player', value: '16 p' });
    expect(card(insights, 'highest-score')).toMatchObject({ subject: 'Beta Player', value: '16 p' });
    expect(card(insights, 'most-exact-scores')).toMatchObject({ subject: 'Beta Player', value: '2' });
    expect(card(insights, 'highest-hit-rate')).toMatchObject({ subject: 'Beta Player', value: '100%' });
  });

  it('hides unverified historical metrics instead of rendering them', () => {
    const insights = buildPredictionLeagueInsights({
      repository,
      leaderboardEntries: [
        entry({ playerId: 'beta', rank: 1, points: 16, exactScores: 2, correctResults: 3, hitRate: 1, matchesScored: 3 }),
        entry({ playerId: 'alpha', rank: 2, points: 12, exactScores: 1, correctResults: 2, hitRate: 2 / 3, matchesScored: 3 }),
        entry({ playerId: 'gamma', rank: 3, points: 0, exactScores: 0, correctResults: 0, hitRate: 0, matchesScored: 3 })
      ]
    });

    const renderedIds = new Set([...insights.statistics.cards, ...insights.records.cards].map((item) => item.id));

    expect(renderedIds.has('biggest-rise-today')).toBe(false);
    expect(renderedIds.has('biggest-fall-today')).toBe(false);
    expect(renderedIds.has('largest-climb')).toBe(false);
    expect(renderedIds.has('largest-drop')).toBe(false);
    expect(renderedIds.has('current-correct-streak')).toBe(false);
    expect(renderedIds.has('current-no-point-streak')).toBe(false);
    expect(renderedIds.has('longest-correct-streak')).toBe(false);
    expect(renderedIds.has('longest-no-point-streak')).toBe(false);
  });

  it('localizes the visible statistics fully to Estonian', () => {
    const insights = buildPredictionLeagueInsights({
      repository,
      leaderboardEntries: [
        entry({ playerId: 'alpha', rank: 1, points: 19, exactScores: 3, correctResults: 3, hitRate: 1, matchesScored: 3 }),
        entry({ playerId: 'beta', rank: 2, points: 16, exactScores: 2, correctResults: 3, hitRate: 1, matchesScored: 3 }),
        entry({ playerId: 'gamma', rank: 3, points: 0, exactScores: 0, correctResults: 0, hitRate: 0, matchesScored: 3 })
      ]
    });

    expect(insights.statistics.eyebrow).toBe('Ennustusliiga');
    expect(insights.statistics.title).toBe('Ennustusliiga statistika');
    expect(insights.records.title).toBe('Rekordid');
    expect(insights.statistics.cards.map((item) => item.title)).toEqual([
      'Mängijate arv',
      'Keskmine punktisumma',
      'Kokku täpseid skoore'
    ]);
    expect(insights.records.cards.map((item) => item.title)).toEqual([
      'Liider',
      'Kõige rohkem punkte',
      'Kõige rohkem täpseid skoore',
      'Parim tabavus'
    ]);
  });
});
