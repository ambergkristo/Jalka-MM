import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPublicTournamentState, type PublicDashboardSnapshotLike } from '../client/lib/publicTournamentState.js';
import { initialGroupStandings, initialPlayoffBracket, initialTournamentStats } from '../client/data/publicTournamentFallback.js';

let activeState = buildPublicTournamentState(undefined, new Date('2026-06-06T12:00:00.000Z'));

vi.mock('../client/lib/publicApi.js', async () => {
  const actual = await vi.importActual<typeof import('../client/lib/publicApi.js')>('../client/lib/publicApi.js');
  return {
    ...actual,
    usePublicTournamentState: () => activeState
  };
});

import { LandingDashboard } from '../client/pages/LandingDashboard.js';
import { LeaderboardPage } from '../client/pages/LeaderboardPage.js';
import { PlayerDetailPage } from '../client/pages/PlayerDetailPage.js';
import { ResultsPage } from '../client/pages/ResultsPage.js';
import { TournamentPage } from '../client/pages/TournamentPage.js';

function createConfirmedSnapshot(): PublicDashboardSnapshotLike {
  return {
    liveMatches: [],
    todayMatches: [
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
    upcomingMatches: [
      {
        id: '5',
        homeTeam: 'Spain',
        awayTeam: 'Senegal',
        kickoffTime: '13.06.2026 17:00',
        stage: 'Alagrupp G',
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
    groupStandings: [
      {
        group: 'A',
        teams: [
          { rank: 1, team: 'Mexico', played: 1, wins: 1, draws: 0, losses: 0, goalsFor: 2, goalsAgainst: 1, goalDifference: 1, points: 3, state: 'qualified' },
          { rank: 2, team: 'South Africa', played: 1, wins: 0, draws: 0, losses: 1, goalsFor: 1, goalsAgainst: 2, goalDifference: -1, points: 0, state: 'at-risk' }
        ]
      }
    ],
    groupLeaders: [{ group: 'A', team: 'Mexico', points: 3, record: '1-0-0' }],
    topScorers: [{ rank: 1, player: 'Kylian Mbappe', team: 'France', goals: 2, assists: 0 }],
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
    ]
  };
}

describe('public dashboard pages', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T12:00:00.000Z'));
    activeState = buildPublicTournamentState(undefined, new Date('2026-06-06T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders zero-result public pages from the canonical fallback state', () => {
    const landing = renderToStaticMarkup(<LandingDashboard />);
    const results = renderToStaticMarkup(<ResultsPage />);
    const leaderboard = renderToStaticMarkup(<LeaderboardPage />);
    const tournament = renderToStaticMarkup(<TournamentPage />);
    const player = renderToStaticMarkup(<PlayerDetailPage playerId="kristo-amberg" />);

    expect(landing).toContain('Kinnitatud tulemusi veel ei ole');
    expect(landing).toContain('Hetkel ei ole käimasolevaid mänge.');
    expect(landing).toContain('Lõppenud mänge veel ei ole.');
    expect(results).toContain('Hetkel ei ole käimasolevaid mänge.');
    expect(results).toContain('Lõppenud mänge veel ei ole.');
    expect(leaderboard).toContain('Leia mängija');
    expect(leaderboard).toContain('109 mängijat');
    expect(leaderboard).toContain('0%');
    expect(tournament).toContain('Alagrupitabelid');
    expect(tournament).toContain('Maakondade edetabel');
    expect(tournament).toContain('Väravalööjate info ei ole veel saadaval.');
    expect(player).toContain('Kristo Amberg');
    expect(player).not.toContain('@');
  });

  it('renders provisional live scores without treating them as latest confirmed results', () => {
    activeState = buildPublicTournamentState({
      ...createConfirmedSnapshot(),
      liveMatches: [
        {
          id: '8',
          homeTeam: 'Canada',
          awayTeam: 'Bosnia and Herzegovina',
          homeScore: 1,
          awayScore: 0,
          kickoffTime: '14.06.2026 20:00',
          stage: 'Alagrupp C',
          status: 'live',
          venue: ''
        }
      ],
      todayMatches: [],
      latestResults: []
    }, new Date('2026-06-14T18:30:00.000Z'));

    const landing = renderToStaticMarkup(<LandingDashboard />);
    const results = renderToStaticMarkup(<ResultsPage />);

    expect(landing).toContain('OTSE');
    expect(landing).toContain('Hetkeseis 1-0');
    expect(results).toContain('OTSE');
    expect(results).toContain('Hetkeseis 1-0');
    expect(results).toContain('Lõppenud mänge veel ei ole.');
  });

  it('renders confirmed canonical public state consistently across pages', () => {
    activeState = buildPublicTournamentState(createConfirmedSnapshot(), new Date('2026-06-12T12:00:00.000Z'));

    const landing = renderToStaticMarkup(<LandingDashboard />);
    const results = renderToStaticMarkup(<ResultsPage />);
    const leaderboard = renderToStaticMarkup(<LeaderboardPage />);
    const tournament = renderToStaticMarkup(<TournamentPage />);

    expect(landing).toContain('2 / 104');
    expect(landing).toContain('Hetkel ei ole käimasolevaid mänge.');
    expect(landing).toContain('Mehhiko');
    expect(landing).toContain('Lõuna-Aafrika');
    expect(landing).toContain('Lõuna-Korea');
    expect(landing).toContain('Tšehhi');
    expect(results).toContain('Mehhiko');
    expect(results).toContain('Lõuna-Aafrika');
    expect(results).toContain('Lõuna-Korea');
    expect(results).toContain('Tšehhi');
    expect(leaderboard).toContain('6');
    expect(leaderboard).toContain('4');
    expect(tournament).toContain('Mehhiko');
    expect(tournament).toContain('Lõuna-Aafrika');
    expect(tournament).toContain('Väravalööjad');
    expect(tournament).toContain('Maakondade edetabel');
    expect(tournament).toContain('Punkte');
  });
});
