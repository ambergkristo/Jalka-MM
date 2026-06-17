import { describe, expect, it } from 'vitest';
import { buildCountyLeaderboard, normalizeCountyName } from '../domain/countyLeaderboard.js';
import type { LeaderboardEntry, Player } from '../domain/predictionRepository.js';
import { resolveCountyVisual } from '../client/lib/countyVisuals.js';

const players: Player[] = [
  { id: 'a', name: 'A Player', location: 'Rae' },
  { id: 'b', name: 'B Player', location: 'Rae' },
  { id: 'c', name: 'C Player', location: 'Saaremaa' },
  { id: 'd', name: 'D Player', location: 'Tallinn' },
  { id: 'e', name: 'E Player' }
];

function entry(playerId: string, points: number): LeaderboardEntry {
  return {
    playerId,
    rank: 1,
    points,
    totalPoints: points,
    exactScores: 0,
    correctResults: 0,
    hitRate: 0,
    lastUpdatedAt: '2026-06-15T18:00:00.000Z'
  };
}

function player(id: string, name: string, location?: string): Player {
  return { id, name, location };
}

describe('county leaderboard', () => {
  it('scores each county by its top three player points', () => {
    const rows = buildCountyLeaderboard({
      players: [
        player('rae-1', 'Rae One', 'Rae'),
        player('rae-2', 'Rae Two', 'Rae'),
        player('rae-3', 'Rae Three', 'Rae'),
        player('rae-4', 'Rae Four', 'Rae'),
        player('saa-1', 'Saaremaa One', 'Saaremaa'),
        player('saa-2', 'Saaremaa Two', 'Saaremaa'),
        player('saa-3', 'Saaremaa Three', 'Saaremaa'),
        player('tal-1', 'Tallinn One', 'Tallinn'),
        player('tal-2', 'Tallinn Two', 'Tallinn'),
        player('tal-3', 'Tallinn Three', 'Tallinn')
      ],
      leaderboardEntries: [
        entry('rae-1', 40),
        entry('rae-2', 36),
        entry('rae-3', 30),
        entry('rae-4', 24),
        entry('saa-1', 50),
        entry('saa-2', 30),
        entry('saa-3', 24),
        entry('tal-1', 38),
        entry('tal-2', 34),
        entry('tal-3', 30)
      ]
    });

    expect(rows.find((row) => row.county === 'Rae')).toMatchObject({
      totalPoints: 106,
      playerCount: 4,
      topPlayers: [
        expect.objectContaining({ playerId: 'rae-1', points: 40 }),
        expect.objectContaining({ playerId: 'rae-2', points: 36 }),
        expect.objectContaining({ playerId: 'rae-3', points: 30 })
      ]
    });
    expect(rows.find((row) => row.county === 'Saaremaa')).toMatchObject({
      totalPoints: 104,
      topPlayers: [
        expect.objectContaining({ playerId: 'saa-1', points: 50 }),
        expect.objectContaining({ playerId: 'saa-2', points: 30 }),
        expect.objectContaining({ playerId: 'saa-3', points: 24 })
      ]
    });
    expect(rows.find((row) => row.county === 'Tallinn')).toMatchObject({
      totalPoints: 102
    });
    expect(rows.slice(0, 3).map((row) => row.county)).toEqual(['Rae', 'Saaremaa', 'Tallinn']);
    for (const row of rows) {
      expect(row.totalPoints).toBe(row.topPlayers.reduce((sum, player) => sum + player.points, 0));
    }
  });

  it('aggregates multiple players from the same county into one row', () => {
    const rows = buildCountyLeaderboard({
      players,
      leaderboardEntries: [entry('a', 4), entry('b', 6)]
    });

    const raeRows = rows.filter((row) => row.county === 'Rae');
    expect(raeRows).toHaveLength(1);
    expect(raeRows[0].topPlayers.map((player) => player.playerId)).toEqual(['b', 'a']);
  });

  it('does not let many average players beat a county with stronger top three', () => {
    const rows = buildCountyLeaderboard({
      players: [
        player('strong-1', 'Strong One', 'Saaremaa'),
        player('strong-2', 'Strong Two', 'Saaremaa'),
        player('strong-3', 'Strong Three', 'Saaremaa'),
        player('many-1', 'Many One', 'Rae'),
        player('many-2', 'Many Two', 'Rae'),
        player('many-3', 'Many Three', 'Rae'),
        player('many-4', 'Many Four', 'Rae'),
        player('many-5', 'Many Five', 'Rae')
      ],
      leaderboardEntries: [
        entry('strong-1', 50),
        entry('strong-2', 40),
        entry('strong-3', 30),
        entry('many-1', 25),
        entry('many-2', 25),
        entry('many-3', 25),
        entry('many-4', 25),
        entry('many-5', 25)
      ]
    });

    expect(rows[0]).toMatchObject({
      county: 'Saaremaa',
      totalPoints: 120,
      playerCount: 3
    });
    expect(rows[1]).toMatchObject({
      county: 'Rae',
      totalPoints: 75,
      playerCount: 5
    });
  });

  it('sorts tied county scores by county name instead of average points', () => {
    const rows = buildCountyLeaderboard({
      players,
      leaderboardEntries: [entry('a', 6), entry('b', 6), entry('c', 12), entry('d', 12)]
    });

    expect(rows.slice(0, 3).map((row) => row.county)).toEqual(['Rae', 'Saaremaa', 'Tallinn']);
  });

  it('sums only available players when a county has fewer than three players', () => {
    const rows = buildCountyLeaderboard({
      players: [
        player('harku-1', 'Harku One', 'Harku'),
        player('harku-2', 'Harku Two', 'Harku')
      ],
      leaderboardEntries: [entry('harku-1', 11), entry('harku-2', 7)]
    });

    expect(rows[0]).toMatchObject({
      county: 'Harku',
      totalPoints: 18,
      playerCount: 2,
      topPlayers: [
        expect.objectContaining({ playerId: 'harku-1', points: 11 }),
        expect.objectContaining({ playerId: 'harku-2', points: 7 })
      ]
    });
  });

  it('handles missing county safely', () => {
    const rows = buildCountyLeaderboard({
      players,
      leaderboardEntries: [entry('e', 5)]
    });

    expect(rows.find((row) => row.county === 'Andmed puuduvad')).toMatchObject({
      totalPoints: 5,
      playerCount: 1
    });
  });

  it('normalizes common location names', () => {
    expect(normalizeCountyName('  tallinna linn ')).toBe('Tallinn');
    expect(normalizeCountyName('Laane Harju')).toBe('Lääne-Harju');
  });

  it('resolves local county visuals and falls back for missing crests', () => {
    expect(resolveCountyVisual('Haapsalu')).toMatchObject({
      county: 'Haapsalu',
      initials: 'HA',
      isFallback: false,
      crestUrl: '/counties/haapsalu.svg'
    });
    expect(resolveCountyVisual('Tartumaa')).toMatchObject({
      county: 'Tartumaa',
      initials: 'TM',
      isFallback: false,
      crestUrl: '/counties/tartumaa.svg'
    });
    expect(resolveCountyVisual('Saaremaa')).toMatchObject({
      county: 'Saaremaa',
      initials: 'SA',
      isFallback: false,
      crestUrl: expect.stringContaining('upload.wikimedia.org')
    });
    expect(
      resolveCountyVisual('Testimaa', [{ county: 'Testimaa', initials: 'TE', tone: 'blue', crestUrl: '/counties/testimaa.svg' }])
    ).toMatchObject({
      county: 'Testimaa',
      crestUrl: '/counties/testimaa.svg',
      isFallback: false
    });
    expect(resolveCountyVisual('Tundmatu')).toMatchObject({
      county: 'Tundmatu',
      initials: 'TU',
      isFallback: true
    });
  });
});
