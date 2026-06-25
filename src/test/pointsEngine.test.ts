import { describe, expect, it } from 'vitest';
import {
  calculateGroupBonusPoints,
  calculateMatchPredictionPoints,
  calculatePlayoffBonusPoints,
  calculatePlayerPoints,
  calculateTopScorerBonus,
  rebuildLeaderboard,
  type ActualGroupStanding,
  type ActualKnockoutResults,
  type MatchResultForScoring
} from '../domain/pointsEngine.js';
import type { AwardsPrediction, GroupPrediction, KnockoutPrediction, Player, PlayerMatchPrediction } from '../domain/predictionRepository.js';

const finalHomeWin: MatchResultForScoring = { matchId: 1, homeScore: 2, awayScore: 1, isFinal: true };

describe('official group and playoff match scoring', () => {
  it('scores exact score as 6 points', () => {
    expect(calculateMatchPredictionPoints({ playerId: 'p1', matchId: 1, homeScore: 2, awayScore: 1 }, finalHomeWin)).toMatchObject({
      points: 6,
      exactScore: true,
      correctResult: true,
      correctGoalDifference: true
    });
  });

  it('scores correct winner and correct goal difference as 4 points', () => {
    const actual = { matchId: 1, homeScore: 3, awayScore: 1, isFinal: true };
    expect(calculateMatchPredictionPoints({ playerId: 'p1', matchId: 1, homeScore: 2, awayScore: 0 }, actual).points).toBe(4);
  });

  it('scores correct winner only as 2 points', () => {
    expect(calculateMatchPredictionPoints({ playerId: 'p1', matchId: 1, homeScore: 2, awayScore: 0 }, finalHomeWin).points).toBe(2);
  });

  it('scores exact draw as 6 points', () => {
    const actual = { matchId: 2, homeScore: 1, awayScore: 1, isFinal: true };
    expect(calculateMatchPredictionPoints({ playerId: 'p1', matchId: 2, homeScore: 1, awayScore: 1 }, actual).points).toBe(6);
  });

  it('scores correct draw goal difference but not exact as 4 points', () => {
    const actual = { matchId: 2, homeScore: 0, awayScore: 0, isFinal: true };
    expect(calculateMatchPredictionPoints({ playerId: 'p1', matchId: 2, homeScore: 1, awayScore: 1 }, actual).points).toBe(4);
  });

  it('scores wrong outcome as 0 points', () => {
    expect(calculateMatchPredictionPoints({ playerId: 'p1', matchId: 1, homeScore: 1, awayScore: 1 }, finalHomeWin).points).toBe(0);
  });

  it('scores playoff draw after extra time and ignores penalty winner for match points', () => {
    const actual = { matchId: 80, homeScore: 2, awayScore: 2, isFinal: true, penaltyWinner: 'France' };
    expect(calculateMatchPredictionPoints({ playerId: 'p1', matchId: 80, homeScore: 1, awayScore: 1, penaltyWinner: 'Spain' }, actual)).toMatchObject({
      points: 4,
      correctResult: true,
      correctGoalDifference: true
    });
  });
});

describe('official group bonus scoring', () => {
  it('awards winner and runner-up placement bonuses plus immediate 1st/2nd qualifier bonuses', () => {
    const standings: ActualGroupStanding[] = [
      { group: 'A', team: 'Brazil', rank: 1, qualified: true },
      { group: 'A', team: 'Croatia', rank: 2, qualified: true },
      { group: 'A', team: 'Japan', rank: 3, qualified: false },
      { group: 'A', team: 'Canada', rank: 4, qualified: false }
    ];

    const predictions: GroupPrediction[] = [{ playerId: 'p1', group: 'A', first: 'Brazil', second: 'Croatia', third: 'Japan' }];
    expect(calculateGroupBonusPoints(predictions, standings)).toMatchObject({
      points: 21,
      warnings: []
    });
  });

  it('awards only qualifier points when the top two teams are correct but in the wrong order', () => {
    const standings: ActualGroupStanding[] = [
      { group: 'A', team: 'Brazil', rank: 1, qualified: true },
      { group: 'A', team: 'Croatia', rank: 2, qualified: true },
      { group: 'A', team: 'Japan', rank: 3, qualified: false },
      { group: 'A', team: 'Canada', rank: 4, qualified: false }
    ];

    const predictions: GroupPrediction[] = [{ playerId: 'p1', group: 'A', first: 'Croatia', second: 'Brazil', third: 'Japan' }];
    expect(calculateGroupBonusPoints(predictions, standings).points).toBe(6);
  });

  it('does not award third-place qualifier points before all groups are finalized', () => {
    const standings: ActualGroupStanding[] = [
      { group: 'A', team: 'Brazil', rank: 1, qualified: true },
      { group: 'A', team: 'Croatia', rank: 2, qualified: true },
      { group: 'A', team: 'Japan', rank: 3, qualified: false },
      { group: 'A', team: 'Canada', rank: 4, qualified: false }
    ];

    const predictions: GroupPrediction[] = [{ playerId: 'p1', group: 'A', first: 'Brazil', second: 'Croatia', third: 'Japan' }];
    const result = calculateGroupBonusPoints(predictions, standings);

    expect(result.breakdown).toEqual([{
      group: 'A',
      winnerPoints: 10,
      secondPlacePoints: 5,
      qualifierPoints: 6,
      points: 21
    }]);
  });

  it('awards third-place qualifier bonus once all groups are finalized and the team is in the final top eight', () => {
    const standings: ActualGroupStanding[] = [
      { group: 'A', team: 'Brazil', rank: 1, qualified: true },
      { group: 'A', team: 'Croatia', rank: 2, qualified: true },
      { group: 'A', team: 'Japan', rank: 3, qualified: true },
      { group: 'A', team: 'Canada', rank: 4, qualified: false },
      { group: 'B', team: 'France', rank: 1, qualified: true },
      { group: 'B', team: 'Senegal', rank: 2, qualified: true },
      { group: 'B', team: 'Ecuador', rank: 3, qualified: false },
      { group: 'B', team: 'Iran', rank: 4, qualified: false }
    ];

    const qualifiedThirdPrediction: GroupPrediction[] = [{ playerId: 'p1', group: 'A', first: 'Brazil', second: 'Croatia', third: 'Japan' }];
    const nonQualifiedThirdPrediction: GroupPrediction[] = [{ playerId: 'p1', group: 'B', first: 'France', second: 'Senegal', third: 'Ecuador' }];

    expect(calculateGroupBonusPoints(qualifiedThirdPrediction, standings).points).toBe(24);
    expect(calculateGroupBonusPoints(nonQualifiedThirdPrediction, standings).points).toBe(21);
  });

  it('gives zero third-place qualifier bonus when the third-place team does not ultimately qualify', () => {
    const standings: ActualGroupStanding[] = [
      { group: 'B', team: 'France', rank: 1, qualified: true },
      { group: 'B', team: 'Senegal', rank: 2, qualified: true },
      { group: 'B', team: 'Ecuador', rank: 3, qualified: false },
      { group: 'B', team: 'Iran', rank: 4, qualified: false }
    ];

    const predictions: GroupPrediction[] = [{ playerId: 'p1', group: 'B', first: 'Iran', second: 'Ecuador', third: 'Iran' }];
    expect(calculateGroupBonusPoints(predictions, standings).breakdown[0]).toMatchObject({
      winnerPoints: 0,
      secondPlacePoints: 0,
      qualifierPoints: 0,
      points: 0
    });
  });

  it('handles missing group standings safely', () => {
    const predictions: GroupPrediction[] = [{ playerId: 'p1', group: 'A', first: 'Brazil', second: 'Croatia', third: 'Japan' }];
    expect(calculateGroupBonusPoints(predictions, undefined)).toMatchObject({
      points: 0,
      warnings: ['Group bonus skipped: actual group standings are not available.']
    });
  });
});

describe('official playoff and top scorer bonuses', () => {
  const knockoutPrediction: KnockoutPrediction = {
    playerId: 'p1',
    thirdPlaceWinner: 'France',
    rounds: [
      { round: 'R16', teams: ['Brazil', 'France'] },
      { round: 'QF', teams: ['Brazil'] },
      { round: 'SF', teams: ['Brazil'] },
      { round: 'Final', teams: ['Brazil', 'Argentina'] }
    ]
  };
  const actualKnockoutResults: ActualKnockoutResults = {
    stageTeams: {
      R16: ['Brazil'],
      QF: ['Brazil'],
      SF: ['Brazil'],
      Final: ['Brazil']
    },
    thirdPlaceWinner: 'France',
    champion: 'Brazil'
  };

  it('awards stage bonuses by team identity', () => {
    const result = calculatePlayoffBonusPoints({ knockoutPrediction, actualKnockoutResults, championPrediction: 'Brazil' });
    expect(result.points).toBe(15 + 20 + 25 + 30 + 40 + 100);
    expect(result.breakdown.map((row) => `${row.stage}:${row.team}:${row.points}`)).toEqual([
      'R16:Brazil:15',
      'QF:Brazil:20',
      'SF:Brazil:25',
      'Finalist:Brazil:30',
      'ThirdPlaceWinner:France:40',
      'Champion:Brazil:100'
    ]);
  });

  it('awards 50 points for any shared top scorer match', () => {
    const awardsPrediction: AwardsPrediction = {
      playerId: 'p1',
      championTeam: 'Brazil',
      championStatus: 'Still alive',
      topScorerName: 'Kylian Mbappe',
      topScorerTeam: 'France',
      topScorerCurrentGoals: 0,
      topScorerStatus: 'In chase'
    };

    expect(calculateTopScorerBonus(awardsPrediction, [{ name: 'Lionel Messi' }, { name: 'Kylian Mbappe' }]).points).toBe(50);
  });
});

describe('player totals and leaderboard rebuild', () => {
  const players: Player[] = [{ id: 'argo', name: 'Argo' }, { id: 'kristo', name: 'Kristo' }, { id: 'martin', name: 'Martin' }];
  const predictions: PlayerMatchPrediction[] = [
    { playerId: 'argo', matchId: 1, homeScore: 2, awayScore: 1 },
    { playerId: 'argo', matchId: 2, homeScore: 1, awayScore: 1 },
    { playerId: 'kristo', matchId: 1, homeScore: 3, awayScore: 2 },
    { playerId: 'kristo', matchId: 2, homeScore: 2, awayScore: 2 },
    { playerId: 'martin', matchId: 1, homeScore: 1, awayScore: 0 },
    { playerId: 'martin', matchId: 2, homeScore: 3, awayScore: 1 }
  ];
  const results: MatchResultForScoring[] = [
    { matchId: 1, homeScore: 2, awayScore: 1, isFinal: true },
    { matchId: 2, homeScore: 0, awayScore: 0, isFinal: true }
  ];

  it('calculates official player total points and hit rate', () => {
    const argo = calculatePlayerPoints('argo', predictions, results);
    expect(argo).toMatchObject({
      matchPoints: 10,
      totalPoints: 10,
      exactScores: 1,
      correctResults: 2,
      hitRate: 1,
      matchesScored: 2
    });
  });

  it('orders leaderboard by total points, exact scores, correct results, then player id', () => {
    const leaderboard = rebuildLeaderboard({ players, predictions, results, recalculatedAt: '2026-06-15T18:00:00.000Z' });
    expect(leaderboard.entries.map((entry) => `${entry.rank}:${entry.playerId}:${entry.points}:${entry.exactScores}:${entry.correctResults}`)).toEqual([
      '1:argo:10:1:2',
      '2:kristo:8:0:2',
      '3:martin:4:0:1'
    ]);
  });

  it('uses exact score as the first tiebreak', () => {
    const leaderboard = rebuildLeaderboard({
      players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      predictions: [
        { playerId: 'a', matchId: 1, homeScore: 2, awayScore: 1 },
        { playerId: 'a', matchId: 2, homeScore: 9, awayScore: 0 },
        { playerId: 'b', matchId: 1, homeScore: 3, awayScore: 2 },
        { playerId: 'b', matchId: 2, homeScore: 1, awayScore: 0 }
      ],
      results: [
        { matchId: 1, homeScore: 2, awayScore: 1, isFinal: true },
        { matchId: 2, homeScore: 2, awayScore: 0, isFinal: true }
      ],
      recalculatedAt: '2026-06-15T18:00:00.000Z'
    });
    expect(leaderboard.entries.map((entry) => entry.playerId)).toEqual(['a', 'b']);
  });

  it('uses correct result as the second tiebreak and player id as the stable final tiebreak', () => {
    const leaderboard = rebuildLeaderboard({
      players: [{ id: 'z-player', name: 'Z' }, { id: 'a-player', name: 'A' }, { id: 'm-player', name: 'M' }],
      predictions: [
        { playerId: 'z-player', matchId: 1, homeScore: 3, awayScore: 1 },
        { playerId: 'a-player', matchId: 1, homeScore: 1, awayScore: 0 },
        { playerId: 'm-player', matchId: 1, homeScore: 1, awayScore: 0 }
      ],
      results: [{ matchId: 1, homeScore: 2, awayScore: 1, isFinal: true }],
      recalculatedAt: '2026-06-15T18:00:00.000Z'
    });
    expect(leaderboard.entries.map((entry) => entry.playerId)).toEqual(['a-player', 'm-player', 'z-player']);
  });

  it('includes official group, playoff, and top scorer bonuses in leaderboard totals', () => {
    const players: Player[] = [{ id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' }];
    const predictions: PlayerMatchPrediction[] = [{ playerId: 'p1', matchId: 1, homeScore: 2, awayScore: 1 }];
    const groupPredictions: GroupPrediction[] = [{ playerId: 'p1', group: 'A', first: 'Team A', second: 'Team B', third: 'Team C' }];
    const knockoutPrediction: KnockoutPrediction = {
      playerId: 'p1',
      rounds: [
        { round: 'R16', teams: ['R16 Team'] },
        { round: 'QF', teams: ['QF Team'] },
        { round: 'SF', teams: ['SF Team'] },
        { round: 'Final', teams: ['Final Team'] }
      ],
      thirdPlaceWinner: 'Third Team'
    };
    const awardsPrediction: AwardsPrediction = {
      playerId: 'p1',
      championTeam: 'Champion Team',
      championStatus: 'Won Tournament',
      topScorerName: 'Lionel Messi',
      topScorerTeam: 'Argentina',
      topScorerCurrentGoals: 0,
      topScorerStatus: 'Leading'
    };

    const leaderboard = rebuildLeaderboard({
      players,
      predictions,
      groupPredictions,
      knockoutPredictions: [knockoutPrediction],
      awardsPredictions: [awardsPrediction],
      results: [{ matchId: 1, homeScore: 2, awayScore: 1, isFinal: true }],
      actualGroupStandings: [
        { group: 'A', team: 'Team A', rank: 1, qualified: true },
        { group: 'A', team: 'Team B', rank: 2, qualified: true },
        { group: 'A', team: 'Team C', rank: 3, qualified: true },
        { group: 'A', team: 'Team D', rank: 4, qualified: false }
      ],
      actualKnockoutResults: {
        stageTeams: {
          R16: ['R16 Team'],
          QF: ['QF Team'],
          SF: ['SF Team'],
          Final: ['Final Team']
        },
        thirdPlaceWinner: 'Third Team',
        champion: 'Champion Team'
      },
      actualTopScorers: [{ name: 'Lionel Messi' }, { name: 'Kylian Mbappe' }],
      recalculatedAt: '2026-06-15T18:00:00.000Z'
    });

    expect(leaderboard.entries[0]).toMatchObject({
      playerId: 'p1',
      matchPoints: 6,
      groupBonusPoints: 24,
      playoffBonusPoints: 230,
      topScorerBonusPoints: 50,
      totalPoints: 310
    });
    expect(leaderboard.entries[1]).toMatchObject({ playerId: 'p2', totalPoints: 0 });
  });
});
