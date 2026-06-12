import { describe, expect, it } from 'vitest';
import { buildPublicTournamentState, selectPublicMatchSection, type PublicDashboardSnapshotLike } from '../client/lib/publicTournamentState.js';
import { initialGroupStandings, initialPlayoffBracket, initialTournamentStats } from '../client/data/publicTournamentFallback.js';
import { predictionRepository } from '../domain/predictionRepository.js';

function createSnapshot(overrides: Partial<PublicDashboardSnapshotLike> = {}): PublicDashboardSnapshotLike {
  return {
    upcomingMatches: [
      {
        id: '3',
        homeTeam: 'Germany',
        awayTeam: 'Colombia',
        kickoffTime: '12.06.2026 17:00',
        stage: 'Alagrupp E',
        status: 'scheduled',
        venue: ''
      },
      {
        id: '4',
        homeTeam: 'Argentina',
        awayTeam: 'Korea Republic',
        kickoffTime: '12.06.2026 20:00',
        stage: 'Alagrupp F',
        status: 'scheduled',
        venue: ''
      }
    ],
    latestResults: [
      {
        id: '1',
        homeTeam: 'Mexico',
        awayTeam: 'South Africa',
        homeScore: 2,
        awayScore: 1,
        stage: 'Alagrupp A',
        winner: 'Mexico',
        finishedAt: '12.06.2026 10:00'
      },
      {
        id: '2',
        homeTeam: 'Korea Republic',
        awayTeam: 'Czechia',
        homeScore: 2,
        awayScore: 1,
        stage: 'Alagrupp B',
        winner: 'Korea Republic',
        finishedAt: '12.06.2026 13:00'
      }
    ],
    groupStandings: initialGroupStandings,
    groupLeaders: initialGroupStandings.map((group) => ({ group: group.group })),
    topScorers: [],
    playoffBracket: initialPlayoffBracket,
    tournamentSummary: [
      { label: 'Turniiri faas', value: 'Alagrupid', detail: 'Turniir on alanud', tone: 'gold' },
      { label: 'Mängitud', value: '2 / 104', detail: '102 kohtumist on veel ees', tone: 'blue' },
      { label: 'Väravad', value: '6', detail: '3,00 väravat mängu kohta', tone: 'green' },
      { label: 'Võistkonnad', value: '48', detail: 'Alagrupid A-L', tone: 'red' }
    ],
    tournamentStats: initialTournamentStats,
    tournamentProgressByStage: [
      { stage: 'Alagrupid', completed: 2, total: 72 },
      { stage: '1/16-finaalid', completed: 0, total: 16 },
      { stage: 'Kaheksandikfinaalid', completed: 0, total: 8 },
      { stage: 'Veerandfinaalid', completed: 0, total: 4 },
      { stage: 'Poolfinaalid', completed: 0, total: 2 },
      { stage: 'Finaalid', completed: 0, total: 2 }
    ],
    leaderboard: [
      { playerId: 'kristo-amberg', rank: 1, points: 6, exactScores: 1, correctResults: 2, hitRate: 0.5, previousRank: 2 },
      { playerId: 'vallo-poldma', rank: 2, points: 4, exactScores: 0, correctResults: 2, hitRate: 0.5 }
    ],
    ...overrides
  };
}

describe('public tournament state', () => {
  it('returns zeroed public state when no confirmed results exist', () => {
    const state = buildPublicTournamentState(undefined, new Date('2026-06-06T12:00:00.000Z'));

    expect(state.playedCount).toBe(0);
    expect(state.latestResults).toEqual([]);
    expect(state.leaderboardRows).toHaveLength(109);
    expect(state.leaderboardRows.every((row) => row.points === 0 && row.exactScores === 0 && row.correctResults === 0 && row.hitRate === '0%')).toBe(true);

    const matchSection = selectPublicMatchSection(undefined, new Date('2026-06-06T12:00:00.000Z'), 3);
    expect(matchSection.matches.length).toBeGreaterThan(0);
    expect(matchSection.matches[0]).toMatchObject({
      homeTeam: 'Mexico',
      awayTeam: 'South Africa',
      stage: 'Alagrupp A'
    });
  });

  it('passes through confirmed results, upcoming fixtures, standings, and leaderboard rows', () => {
    const snapshot = createSnapshot();
    const state = buildPublicTournamentState(snapshot, new Date('2026-06-12T12:00:00.000Z'));
    const matchSection = selectPublicMatchSection(snapshot, new Date('2026-06-12T12:00:00.000Z'), 3);

    expect(state.playedCount).toBe(2);
    expect(state.latestResults).toHaveLength(2);
    expect(state.upcomingMatches).toHaveLength(2);
    expect(state.leaderboardRows).toHaveLength(109);
    expect(state.leaderboardRows.find((row) => row.playerId === 'kristo-amberg')).toMatchObject({
      playerId: 'kristo-amberg',
      points: 6,
      exactScores: 1,
      correctResults: 2
    });
    expect(state.groupStandings).toBe(initialGroupStandings);
    expect(state.playoffBracket).toBe(initialPlayoffBracket);
    expect(state.tournamentStats).toBe(initialTournamentStats);
    expect(matchSection.matches.map((match) => match.id)).toEqual(['3', '4']);
  });

  it('fills partial leaderboard snapshots to all 109 players', () => {
    const partialSnapshot = createSnapshot({
      leaderboard: predictionRepository.getLeaderboard().slice(0, 24)
    });

    const state = buildPublicTournamentState(partialSnapshot, new Date('2026-06-12T12:00:00.000Z'));
    const canonicalLeaderboard = predictionRepository.getLeaderboard();

    expect(state.leaderboardRows).toHaveLength(109);
    expect(state.leaderboardRows.slice(0, 24).some((row) => row.points > 0)).toBe(true);
    expect(state.leaderboardRows[24]).toMatchObject({
      playerId: canonicalLeaderboard[24].playerId,
      rank: 25,
      points: 0,
      exactScores: 0,
      correctResults: 0,
      hitRate: '0%'
    });
  });
});
