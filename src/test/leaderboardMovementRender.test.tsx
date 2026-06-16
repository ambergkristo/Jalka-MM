import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialGroupStandings, initialPlayoffBracket, initialTournamentStats } from '../client/data/publicTournamentFallback.js';
import { buildPublicTournamentState, type PublicDashboardSnapshotLike } from '../client/lib/publicTournamentState.js';

let activeState = buildPublicTournamentState(undefined, new Date('2026-06-06T12:00:00.000Z'));

vi.mock('../client/lib/publicApi.js', async () => {
  const actual = await vi.importActual<typeof import('../client/lib/publicApi.js')>('../client/lib/publicApi.js');
  return {
    ...actual,
    usePublicTournamentState: () => activeState
  };
});

import { LeaderboardPage } from '../client/pages/LeaderboardPage.js';

function createMovementSnapshot(): PublicDashboardSnapshotLike {
  return {
    liveMatches: [],
    todayMatches: [],
    upcomingMatches: [],
    latestResults: [],
    groupStandings: initialGroupStandings,
    groupLeaders: initialGroupStandings.map((group) => ({ group: group.group })),
    topScorers: [],
    playoffBracket: initialPlayoffBracket,
    tournamentSummary: [],
    tournamentStats: initialTournamentStats,
    tournamentProgressByStage: [],
    leaderboard: [
      { playerId: 'kristo-amberg', rank: 1, points: 24, exactScores: 4, correctResults: 6, hitRate: 0.8, previousRank: 2 },
      { playerId: 'vallo-poldma', rank: 2, points: 20, exactScores: 3, correctResults: 5, hitRate: 0.7, previousRank: 1 },
      { playerId: 'henri-kotsar', rank: 3, points: 16, exactScores: 2, correctResults: 4, hitRate: 0.6, previousRank: 3 },
      { playerId: 'madde-jerbach', rank: 4, points: 14, exactScores: 2, correctResults: 3, hitRate: 0.55, previousRank: 8 }
    ]
  };
}

describe('leaderboard movement rendering', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T12:00:00.000Z'));
    activeState = buildPublicTournamentState(createMovementSnapshot(), new Date('2026-06-06T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders up, down, neutral, and lower-table movement indicators', () => {
    const markup = renderToStaticMarkup(<LeaderboardPage />);

    expect(markup).toContain('▲1');
    expect(markup).toContain('▼1');
    expect(markup).toContain('—');
    expect(markup).toContain('▲4');
  });
});
