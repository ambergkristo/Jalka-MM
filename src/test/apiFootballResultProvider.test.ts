import { describe, expect, it, vi } from 'vitest';
import { ApiFootballResultProvider, parseApiFootballFixture } from '../server/results/apiFootballResultProvider.js';
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
  provider: 'api-football',
  providerCompetitionId: 'world-cup',
  providerSeason: '2026',
  providerFixtureId: '1001',
  confidence: 'confirmed'
}];

describe('API-Football result provider', () => {
  it('normalizes scheduled, live, half-time, and final sample responses', () => {
    expect(parseApiFootballFixture(sampleFixture('NS'))).toMatchObject({ rawStatus: 'SCHEDULED' });
    expect(parseApiFootballFixture(sampleFixture('1H', 1, 0, 23))).toMatchObject({ rawStatus: 'LIVE', homeScore: 1, awayScore: 0, minute: 23 });
    expect(parseApiFootballFixture(sampleFixture('HT', 1, 1, 45))).toMatchObject({ rawStatus: 'HT', homeScore: 1, awayScore: 1, minute: 45 });
    expect(parseApiFootballFixture(sampleFixture('FT', 2, 1, 90))).toMatchObject({ rawStatus: 'FINISHED', homeScore: 2, awayScore: 1, minute: 90 });
    expect(parseApiFootballFixture(sampleFixture('PEN', 1, 1, 120))).toMatchObject({ rawStatus: 'FINISHED', homeScore: 1, awayScore: 1, minute: 120 });
  });

  it('skips safely when provider fixture id is missing and does not call fetch', async () => {
    const fetchImpl = vi.fn();
    const provider = new ApiFootballResultProvider({ apiKey: 'key', apiBaseUrl: 'https://api.example', competitionId: 'world-cup', season: '2026' }, [], fetchImpl);
    const update = await provider.fetchMatchUpdate(match, new Date('2026-06-11T18:30:00.000Z'));

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(update).toMatchObject({
      provider: 'api-football-result-provider',
      isFinal: false,
      warning: 'API-Football fixture id is missing for internal match 1; provider call skipped.'
    });
  });

  it('fetches mapped fixture with API-Football headers when configured', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({ response: [sampleFixture('FT', 2, 0, 90)] })
    }));
    const provider = new ApiFootballResultProvider(
      { apiKey: 'key', apiBaseUrl: 'https://v3.football.api-sports.io', apiHost: 'v3.football.api-sports.io', competitionId: 'world-cup', season: '2026' },
      matchMap,
      fetchImpl
    );
    const update = await provider.fetchMatchUpdate(match, new Date('2026-06-11T21:00:00.000Z'));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0][0])).toContain('/fixtures?id=1001');
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      headers: {
        'x-apisports-key': 'key',
        'x-rapidapi-host': 'v3.football.api-sports.io'
      }
    });
    expect(update).toMatchObject({ status: 'FINISHED', isFinal: true, homeScore: 2, awayScore: 0 });
  });
});

function sampleFixture(short: string, home?: number, away?: number, elapsed?: number) {
  return {
    fixture: {
      id: 1001,
      date: '2026-06-11T21:00:00+00:00',
      status: { short, elapsed }
    },
    goals: { home, away },
    score: { fulltime: { home, away } }
  };
}
