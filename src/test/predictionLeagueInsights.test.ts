import { describe, expect, it } from 'vitest';
import type { AwardsPrediction, GroupPrediction, KnockoutPrediction, LeaderboardEntry, Player, PlayerMatchPrediction } from '../domain/predictionRepository.js';
import { buildPredictionLeagueInsights } from '../server/results/predictionLeagueInsights.js';

const players: Player[] = [
  { id: 'alpha', name: 'Alpha Player' },
  { id: 'beta', name: 'Beta Player' },
  { id: 'gamma', name: 'Gamma Player' }
];

const matchPredictions: PlayerMatchPrediction[] = [
  { playerId: 'alpha', matchId: 1, homeScore: 2, awayScore: 1 },
  { playerId: 'alpha', matchId: 2, homeScore: 1, awayScore: 0 },
  { playerId: 'alpha', matchId: 3, homeScore: 0, awayScore: 1 },
  { playerId: 'beta', matchId: 1, homeScore: 1, awayScore: 0 },
  { playerId: 'beta', matchId: 2, homeScore: 1, awayScore: 0 },
  { playerId: 'beta', matchId: 3, homeScore: 0, awayScore: 0 },
  { playerId: 'gamma', matchId: 1, homeScore: 0, awayScore: 1 },
  { playerId: 'gamma', matchId: 2, homeScore: 0, awayScore: 2 },
  { playerId: 'gamma', matchId: 3, homeScore: 1, awayScore: 0 }
];

const groupPredictions: GroupPrediction[] = [
  { playerId: 'alpha', group: 'A', first: 'Alpha FC', second: 'Gamma FC', third: 'Beta FC' },
  { playerId: 'beta', group: 'A', first: 'Alpha FC', second: 'Gamma FC', third: 'Beta FC' },
  { playerId: 'gamma', group: 'A', first: 'Beta FC', second: 'Alpha FC', third: 'Gamma FC' }
];

const knockoutPredictions: KnockoutPrediction[] = [];
const awardsPredictions: AwardsPrediction[] = [];

const repository = {
  getPlayers: () => players,
  getMatchPredictions: (playerId?: string) => matchPredictions.filter((row) => !playerId || row.playerId === playerId),
  getGroupPredictions: (playerId?: string) => groupPredictions.filter((row) => !playerId || row.playerId === playerId),
  getKnockoutPredictions: (playerId?: string) => knockoutPredictions.filter((row) => !playerId || row.playerId === playerId),
  getAwardsPredictions: (playerId?: string) => awardsPredictions.filter((row) => !playerId || row.playerId === playerId)
};

const teams = [
  { id: 'A1', name: 'Alpha FC', nameEt: 'Alpha FC', code: 'ALP', groupId: 'A' },
  { id: 'A2', name: 'Beta FC', nameEt: 'Beta FC', code: 'BET', groupId: 'A' },
  { id: 'A3', name: 'Gamma FC', nameEt: 'Gamma FC', code: 'GAM', groupId: 'A' },
  { id: 'A4', name: 'Delta FC', nameEt: 'Delta FC', code: 'DEL', groupId: 'A' }
];

const allMatches = [
  { matchId: 1, stage: 'GROUP', groupId: 'A', kickoffAt: '2026-06-12T16:00:00.000Z', homeTeamId: 'A1', awayTeamId: 'A2', homeTeam: 'Alpha FC', awayTeam: 'Beta FC', homeTeamCode: 'ALP', awayTeamCode: 'BET' },
  { matchId: 2, stage: 'GROUP', groupId: 'A', kickoffAt: '2026-06-12T19:00:00.000Z', homeTeamId: 'A3', awayTeamId: 'A4', homeTeam: 'Gamma FC', awayTeam: 'Delta FC', homeTeamCode: 'GAM', awayTeamCode: 'DEL' },
  { matchId: 3, stage: 'GROUP', groupId: 'A', kickoffAt: '2026-06-13T19:00:00.000Z', homeTeamId: 'A1', awayTeamId: 'A3', homeTeam: 'Alpha FC', awayTeam: 'Gamma FC', homeTeamCode: 'ALP', awayTeamCode: 'GAM' }
];

const confirmedMatches = [
  { ...allMatches[0], homeScore: 2, awayScore: 1 },
  { ...allMatches[1], homeScore: 1, awayScore: 0 },
  { ...allMatches[2], homeScore: 0, awayScore: 0 }
];

const scorerFacts = [
  { matchId: 1, playerName: 'Player One', goals: 1 },
  { matchId: 1, playerName: 'Player Two', goals: 1 },
  { matchId: 1, playerName: 'Player Three', goals: 1 },
  { matchId: 2, playerName: 'Player Four', goals: 1 },
  { matchId: 3, playerName: 'Player Five', goals: 1 }
];

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
  it('derives live statistics from the canonical leaderboard and streak state', () => {
    const insights = buildPredictionLeagueInsights({
      teams,
      allMatches,
      confirmedMatches,
      scorerFacts,
      now: new Date('2026-06-13T20:00:00.000Z'),
      repository,
      leaderboardEntries: [
        entry({ playerId: 'beta', rank: 1, points: 16, exactScores: 2, correctResults: 3, hitRate: 1, matchesScored: 3, previousRank: 2 }),
        entry({ playerId: 'alpha', rank: 2, points: 12, exactScores: 2, correctResults: 2, hitRate: 2 / 3, matchesScored: 3, previousRank: 1 }),
        entry({ playerId: 'gamma', rank: 3, points: 0, exactScores: 0, correctResults: 0, hitRate: 0, matchesScored: 3, previousRank: 3 })
      ]
    });

    expect(card(insights, 'highest-hit-rate')).toMatchObject({
      subject: 'Beta Player',
      value: '100%'
    });
    expect(card(insights, 'most-exact-scores')).toMatchObject({
      subject: 'Beta Player',
      value: '2'
    });
    expect(card(insights, 'current-correct-streak')).toMatchObject({
      subject: 'Beta Player',
      value: '3'
    });
    expect(card(insights, 'current-no-point-streak')).toMatchObject({
      subject: 'Gamma Player',
      value: '3'
    });
    expect(card(insights, 'total-points-awarded')).toMatchObject({ value: '28' });
    expect(card(insights, 'average-points')).toMatchObject({ value: '9,33' });
    expect(card(insights, 'average-exacts')).toMatchObject({ value: '1,33' });
  });

  it('computes rise/fall and historical daily records from rebuild snapshots', () => {
    const insights = buildPredictionLeagueInsights({
      teams,
      allMatches,
      confirmedMatches,
      scorerFacts,
      now: new Date('2026-06-13T20:00:00.000Z'),
      repository,
      leaderboardEntries: [
        entry({ playerId: 'beta', rank: 1, points: 16, exactScores: 2, correctResults: 3, hitRate: 1, matchesScored: 3, previousRank: 2 }),
        entry({ playerId: 'alpha', rank: 2, points: 12, exactScores: 2, correctResults: 2, hitRate: 2 / 3, matchesScored: 3, previousRank: 1 }),
        entry({ playerId: 'gamma', rank: 3, points: 0, exactScores: 0, correctResults: 0, hitRate: 0, matchesScored: 3, previousRank: 3 })
      ]
    });

    expect(card(insights, 'biggest-rise-today')).toMatchObject({
      subject: 'Beta Player',
      value: '+1',
      detail: '13.06 tõus'
    });
    expect(card(insights, 'biggest-fall-today')).toMatchObject({
      subject: 'Alpha Player',
      value: '-1',
      detail: '13.06 langus'
    });
    expect(card(insights, 'highest-single-matchday-score')).toMatchObject({
      subject: 'Beta Player',
      value: '27 p',
      detail: '13.06'
    });
    expect(card(insights, 'largest-climb')).toMatchObject({
      subject: 'Beta Player',
      value: '+1'
    });
    expect(card(insights, 'largest-drop')).toMatchObject({
      subject: 'Alpha Player',
      value: '-1'
    });
    expect(card(insights, 'best-knockout-predictor')).toMatchObject({
      value: '—',
      detail: 'Playoff pole veel alanud',
      unavailable: true
    });
  });

  it('updates record cards when the rebuilt leaderboard leader changes', () => {
    const insights = buildPredictionLeagueInsights({
      teams,
      allMatches,
      confirmedMatches,
      scorerFacts,
      now: new Date('2026-06-13T20:00:00.000Z'),
      repository,
      leaderboardEntries: [
        entry({ playerId: 'alpha', rank: 1, points: 19, exactScores: 3, correctResults: 3, hitRate: 1, matchesScored: 3 }),
        entry({ playerId: 'beta', rank: 2, points: 16, exactScores: 2, correctResults: 3, hitRate: 1, matchesScored: 3 }),
        entry({ playerId: 'gamma', rank: 3, points: 0, exactScores: 0, correctResults: 0, hitRate: 0, matchesScored: 3 })
      ]
    });

    expect(card(insights, 'current-leader')).toMatchObject({
      subject: 'Alpha Player',
      value: '19 p'
    });
    expect(card(insights, 'highest-score')).toMatchObject({
      subject: 'Alpha Player',
      value: '19 p'
    });
  });
});
