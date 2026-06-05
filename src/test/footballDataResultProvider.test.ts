import { describe, expect, it, vi } from 'vitest';
import { FootballDataResultProvider, parseFootballDataMatch } from '../server/results/footballDataResultProvider.js';
import type { ProviderMatchMapEntry } from '../server/results/providerMatchMap.js';
import type { TrackedMatch } from '../server/results/resultTypes.js';

const match: TrackedMatch = {
  id: 1,
  kickoffUtc: '2026-06-11T19:00:00.000Z',
  status: 'SCHEDULED',
  homeTeam: 'Mexico',
  awayTeam: 'Canada',
  isFinal: false
};

const matchMap: ProviderMatchMapEntry[] = [{
  internalMatchId: 1,
  provider: 'football-data',
  providerCompetitionId: 'WC',
  providerSeason: '2026',
  providerFixtureId: '2001',
  confidence: 'confirmed'
}];

describe('football-data.org result provider', () => {
  it('normalizes scheduled and final sample responses', () => {
    expect(parseFootballDataMatch(sampleMatch('TIMED'))).toMatchObject({ rawStatus: 'SCHEDULED' });
    expect(parseFootballDataMatch(sampleMatch('IN_PLAY', 1, 0))).toMatchObject({ rawStatus: 'LIVE', homeScore: 1, awayScore: 0 });
    expect(parseFootballDataMatch(sampleMatch('PAUSED', 1, 1))).toMatchObject({ rawStatus: 'HT', homeScore: 1, awayScore: 1 });
    expect(parseFootballDataMatch(sampleMatch('FINISHED', 3, 2))).toMatchObject({ rawStatus: 'FINISHED', homeScore: 3, awayScore: 2 });
  });

  it('skips safely when provider fixture id is missing and does not call fetch', async () => {
    const fetchImpl = vi.fn();
    const provider = new FootballDataResultProvider({ apiKey: 'key', apiBaseUrl: 'https://api.example', competitionId: 'WC', season: '2026' }, [], fetchImpl);
    const update = await provider.fetchMatchUpdate(match, new Date('2026-06-11T18:30:00.000Z'));

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(update).toMatchObject({
      provider: 'football-data-result-provider',
      isFinal: false,
      warning: 'football-data.org fixture id is missing for internal match 1; provider call skipped.'
    });
  });

  it('fetches mapped fixture with football-data token header when configured', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => sampleMatch('FINISHED', 2, 0)
    }));
    const provider = new FootballDataResultProvider(
      { apiKey: 'token', apiBaseUrl: 'https://api.football-data.org/v4', competitionId: 'WC', season: '2026' },
      matchMap,
      fetchImpl
    );
    const update = await provider.fetchMatchUpdate(match, new Date('2026-06-11T21:00:00.000Z'));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0][0])).toBe('https://api.football-data.org/v4/matches/2001');
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      headers: {
        'X-Auth-Token': 'token'
      }
    });
    expect(update).toMatchObject({ status: 'FINISHED', isFinal: true, homeScore: 2, awayScore: 0 });
  });
});

function sampleMatch(status: string, home?: number, away?: number) {
  return {
    id: 2001,
    status,
    utcDate: '2026-06-11T19:00:00Z',
    lastUpdated: '2026-06-11T21:00:00Z',
    score: {
      fullTime: { home, away },
      regularTime: { home, away }
    }
  };
}
