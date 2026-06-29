import { describe, expect, it } from 'vitest';
import { calculatePlayerPoints } from '../domain/pointsEngine.js';
import type { KnockoutPrediction, PlayerMatchPrediction } from '../domain/predictionRepository.js';

describe('playoff leaderboard bonus', () => {
  it('awards both match points for #73 and the Canada R16 bonus from canonical knockout results', () => {
    const predictions: PlayerMatchPrediction[] = [
      { playerId: 'player-1', matchId: 73, homeScore: 0, awayScore: 1 }
    ];
    const knockoutPrediction: KnockoutPrediction = {
      playerId: 'player-1',
      rounds: [
        { round: 'R16', teams: ['Canada'] }
      ],
      thirdPlaceWinner: undefined
    };

    const result = calculatePlayerPoints('player-1', predictions, [
      { matchId: 73, homeScore: 0, awayScore: 1, isFinal: true }
    ], {
      knockoutPrediction,
      actualKnockoutResults: {
        stageTeams: {
          R16: ['Kanada']
        }
      }
    });

    expect(result.matchPoints).toBe(6);
    expect(result.playoffBonusPoints).toBe(15);
    expect(result.totalPoints).toBe(21);
    expect(result.playoffBreakdown).toEqual([
      { stage: 'R16', team: 'Kanada', points: 15 }
    ]);
  });
});
