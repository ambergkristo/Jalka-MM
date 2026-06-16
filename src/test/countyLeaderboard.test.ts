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

describe('county leaderboard', () => {
  it('sums player points by county', () => {
    const rows = buildCountyLeaderboard({
      players,
      leaderboardEntries: [entry('a', 12), entry('b', 8), entry('c', 10), entry('d', 4), entry('e', 2)]
    });

    expect(rows.find((row) => row.county === 'Rae')).toMatchObject({
      totalPoints: 20,
      playerCount: 2
    });
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

  it('sorts counties by total points descending', () => {
    const rows = buildCountyLeaderboard({
      players,
      leaderboardEntries: [entry('a', 4), entry('b', 6), entry('c', 18), entry('d', 2)]
    });

    expect(rows.slice(0, 2).map((row) => row.county)).toEqual(['Saaremaa', 'Rae']);
  });

  it('uses average points and county name as tie-breakers', () => {
    const rows = buildCountyLeaderboard({
      players,
      leaderboardEntries: [entry('a', 6), entry('b', 6), entry('c', 12), entry('d', 12)]
    });

    expect(rows.slice(0, 3).map((row) => row.county)).toEqual(['Saaremaa', 'Tallinn', 'Rae']);
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
