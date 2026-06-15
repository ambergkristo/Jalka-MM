import { describe, expect, it } from 'vitest';
import { buildPublicTournamentState, selectLiveMatchSection, selectPublicMatchSection, type PublicDashboardSnapshotLike } from '../client/lib/publicTournamentState.js';
import { initialGroupStandings, initialPlayoffBracket, initialTournamentStats } from '../client/data/publicTournamentFallback.js';
import { predictionRepository } from '../domain/predictionRepository.js';
import type { LeaderboardEntry } from '../domain/predictionRepository.js';

function createSnapshot(overrides: Partial<PublicDashboardSnapshotLike> = {}): PublicDashboardSnapshotLike {
  return {
    liveMatches: [],
    todayMatches: [
      {
        id: '1',
        homeTeam: 'Mexico',
        awayTeam: 'South Africa',
        kickoffTime: '12.06.2026 10:00',
        stage: 'Alagrupp A',
        status: 'scheduled',
        venue: ''
      },
      {
        id: '2',
        homeTeam: 'Korea Republic',
        awayTeam: 'Czechia',
        kickoffTime: '12.06.2026 13:00',
        stage: 'Alagrupp B',
        status: 'scheduled',
        venue: ''
      }
    ],
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

function leaderboardRow(input: Partial<LeaderboardEntry> & Pick<LeaderboardEntry, 'playerId'>): LeaderboardEntry {
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

describe('public tournament state', () => {
  it('returns zeroed public state when no confirmed results exist', () => {
    const state = buildPublicTournamentState({
      liveMatches: [],
      todayMatches: [
        {
          id: '1',
          homeTeam: 'Mexico',
          awayTeam: 'South Africa',
          kickoffTime: '12.06.2026 10:00',
          stage: 'Alagrupp A',
          status: 'scheduled',
          venue: ''
        }
      ],
      upcomingMatches: [],
      latestResults: [],
      groupStandings: initialGroupStandings,
      groupLeaders: initialGroupStandings.map((group) => ({ group: group.group })),
      topScorers: [],
      playoffBracket: initialPlayoffBracket,
      tournamentSummary: [
        { label: 'Turniiri faas', value: 'Alagrupid', detail: 'Turniir on alanud', tone: 'gold' },
        { label: 'Mängitud', value: '0 / 104', detail: 'Kinnitatud tulemusi veel ei ole', tone: 'blue' },
        { label: 'Väravad', value: '0', detail: 'Kinnitatud väravaid veel ei ole', tone: 'green' },
        { label: 'Võistkonnad', value: '48', detail: 'Alagrupid A-L', tone: 'red' }
      ],
      tournamentStats: initialTournamentStats,
      tournamentProgressByStage: [
        { stage: 'Alagrupid', completed: 0, total: 72 },
        { stage: '1/16-finaalid', completed: 0, total: 16 },
        { stage: 'Kaheksandikfinaalid', completed: 0, total: 8 },
        { stage: 'Veerandfinaalid', completed: 0, total: 4 },
        { stage: 'Poolfinaalid', completed: 0, total: 2 },
        { stage: 'Finaalid', completed: 0, total: 2 }
      ],
      leaderboard: []
    }, new Date('2026-06-06T12:00:00.000Z'));

    expect(state.playedCount).toBe(0);
    expect(state.latestResults).toEqual([]);
    expect(state.leaderboardRows).toHaveLength(109);
    expect(state.leaderboardRows.every((row) => row.points === 0 && row.exactScores === 0 && row.correctResults === 0 && row.hitRate === '0%')).toBe(true);

    const matchSection = selectPublicMatchSection(state.snapshot, new Date('2026-06-06T12:00:00.000Z'), 3);
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
    expect(state.liveMatches).toHaveLength(0);
    expect(state.todayMatches).toHaveLength(2);
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
    expect(matchSection.title).toBe('Tänased mängud');
    expect(matchSection.matches.map((match) => match.id)).toEqual(['1', '2']);
  });

  it('uses canonical completed match count for the played KPI instead of latest results length', () => {
    const snapshot = createSnapshot({
      completedMatchesCount: 16,
      totalMatchesCount: 104,
      latestResults: createSnapshot().latestResults.slice(0, 1)
    });

    const state = buildPublicTournamentState(snapshot, new Date('2026-06-12T12:00:00.000Z'));

    expect(state.latestResults).toHaveLength(1);
    expect(state.playedCount).toBe(16);
    expect(state.heroMetrics.map((metric) => metric.value)).toContain('16 / 104');
  });

  it('builds county leaderboard from the canonical public leaderboard rows', () => {
    const snapshot = createSnapshot({
      leaderboard: [
        leaderboardRow({ playerId: 'kristo-amberg', points: 12, totalPoints: 12 }),
        leaderboardRow({ playerId: 'vallo-poldma', points: 6, totalPoints: 6 }),
        leaderboardRow({ playerId: 'henri-kotsar', points: 4, totalPoints: 4 })
      ]
    });

    const state = buildPublicTournamentState(snapshot, new Date('2026-06-12T12:00:00.000Z'));

    expect(state.countyLeaderboard.length).toBeGreaterThan(0);
    expect(state.countyLeaderboard[0]).toMatchObject({
      county: 'Saue',
      totalPoints: 12
    });
    expect(state.countyLeaderboard.find((row) => row.county === 'Rae')).toMatchObject({
      totalPoints: 10,
      playerCount: 27
    });
  });

  it('fills partial leaderboard snapshots to all 109 players', () => {
    const partialSnapshot = createSnapshot({
      leaderboard: predictionRepository.getLeaderboard().slice(0, 24)
    });

    const state = buildPublicTournamentState(partialSnapshot, new Date('2026-06-12T12:00:00.000Z'));
    const canonicalLeaderboard = predictionRepository.getLeaderboard();

    expect(state.leaderboardRows).toHaveLength(109);
    expect(state.leaderboardRows.slice(0, 24).some((row) => row.points > 0)).toBe(true);
    expect(state.leaderboardRows.find((row) => row.playerId === canonicalLeaderboard[108].playerId)).toMatchObject({
      playerId: canonicalLeaderboard[108].playerId,
      points: 0,
      exactScores: 0,
      correctResults: 0,
      hitRate: '0%'
    });
  });

  it('sorts the public dashboard leaderboard by current score before showing the top rows', () => {
    const players = predictionRepository.getPlayers();
    const snapshot = createSnapshot({
      leaderboard: [
        leaderboardRow({ playerId: players[0].id, rank: 1, points: 0, exactScores: 0, correctResults: 0, hitRate: 0 }),
        leaderboardRow({ playerId: players[1].id, rank: 24, points: 12, exactScores: 2, correctResults: 4, hitRate: 0.8 }),
        leaderboardRow({ playerId: players[2].id, rank: 2, points: 12, exactScores: 1, correctResults: 5, hitRate: 0.7 })
      ]
    });

    const state = buildPublicTournamentState(snapshot, new Date('2026-06-12T12:00:00.000Z'));

    expect(state.leaderboardRows).toHaveLength(109);
    expect(state.leaderboardRows.slice(0, 2).map((row) => row.points)).toEqual([12, 12]);
    expect(state.leaderboardRows[0].rank).toBe(1);
    expect(state.leaderboardRows[1].rank).toBe(2);
    expect(state.leaderboardRows[2].points).toBe(0);
  });

  it('selects live matches before today and upcoming matches after confirmation', () => {
    const liveSnapshot = createSnapshot({
      liveMatches: [
        {
          id: '8',
          homeTeam: 'Canada',
          awayTeam: 'Bosnia and Herzegovina',
          homeScore: 1,
          awayScore: 0,
          kickoffTime: '12.06.2026 19:00',
          stage: 'Alagrupp C',
          status: 'live',
          venue: ''
        },
        {
          id: '9',
          homeTeam: 'Brazil',
          awayTeam: 'Croatia',
          kickoffTime: '12.06.2026 21:00',
          stage: 'Alagrupp D',
          status: 'live',
          venue: ''
        }
      ],
      todayMatches: [],
      latestResults: [],
      upcomingMatches: []
    });

    const liveSection = selectLiveMatchSection(liveSnapshot, 3);
    expect(liveSection.title).toBe('Otsemängud');
    expect(liveSection.matches).toHaveLength(2);
    expect(liveSection.matches.every((match) => match.status === 'live')).toBe(true);
    expect(liveSection.matches[0]).toMatchObject({
      id: '8',
      homeScore: 1,
      awayScore: 0
    });
    expect(buildPublicTournamentState(liveSnapshot).latestResults).toEqual([]);

    const upcomingSnapshot = createSnapshot({
      liveMatches: [],
      todayMatches: [
        {
          id: '9',
          homeTeam: 'Germany',
          awayTeam: 'Colombia',
          kickoffTime: '12.06.2026 17:00',
          stage: 'Alagrupp E',
          status: 'scheduled',
          venue: ''
        }
      ],
      latestResults: [],
      upcomingMatches: [
        {
          id: '10',
          homeTeam: 'Argentina',
          awayTeam: 'Korea Republic',
          kickoffTime: '14.06.2026 20:00',
          stage: 'Alagrupp F',
          status: 'scheduled',
          venue: ''
        }
      ]
    });

    const section = selectPublicMatchSection(upcomingSnapshot, new Date('2026-06-12T12:00:00.000Z'), 3);
    expect(section.title).toBe('Tänased mängud');
    expect(section.matches).toHaveLength(1);
    expect(section.matches[0].status).toBe('scheduled');
  });
});
