import { describe, expect, it } from 'vitest';
import { loadResultProviderConfig } from '../server/results/resultProviderConfig.js';
import { SportmonksResultProvider, parseSportmonksFixture } from '../server/results/sportmonksResultProvider.js';
import type { ProviderMatchMapEntry } from '../server/results/providerMatchMap.js';
import type { TrackedMatch } from '../server/results/resultTypes.js';

const config = loadResultProviderConfig({
  RESULTS_PROVIDER: 'sportmonks',
  RESULTS_API_KEY: 'test-key',
  RESULTS_API_BASE_URL: 'https://api.sportmonks.test',
  RESULTS_COMPETITION_ID: '732',
  RESULTS_SEASON: '2026'
});

const match: TrackedMatch = {
  id: 1,
  kickoffUtc: '2026-06-15T18:00:00.000Z',
  status: 'SCHEDULED',
  homeTeam: 'Mexico',
  awayTeam: 'South Africa',
  isFinal: false
};

const matchMap: ProviderMatchMapEntry[] = [{
  internalMatchId: 1,
  provider: 'sportmonks',
  providerCompetitionId: '732',
  providerSeason: '2026',
  providerFixtureId: '12345',
  confidence: 'confirmed'
}];

describe('Sportmonks result provider', () => {
  it('returns a safe warning and skips network when provider fixture id is missing', async () => {
    let fetchCalls = 0;
    const provider = new SportmonksResultProvider(config, [], async () => {
      fetchCalls += 1;
      throw new Error('fetch should not be called without fixture mapping');
    });

    const update = await provider.fetchMatchUpdate(match, new Date('2026-06-15T18:30:00.000Z'));

    expect(fetchCalls).toBe(0);
    expect(update).toMatchObject({
      matchId: 1,
      status: 'SCHEDULED',
      isFinal: false,
      provider: 'sportmonks-result-provider',
      warning: 'Sportmonks fixture id is missing for internal match 1; provider call skipped.'
    });
  });

  it('normalizes a scheduled fixture response', async () => {
    const update = await providerFor(sampleFixture('NS')).fetchMatchUpdate(match, new Date('2026-06-15T18:30:00.000Z'));
    expect(update).toMatchObject({
      providerMatchId: '12345',
      status: 'SCHEDULED',
      isFinal: false,
      rawProviderStatus: 'SCHEDULED'
    });
  });

  it('normalizes a live fixture response with score and minute', async () => {
    const update = await providerFor(sampleFixture('LIVE', 1, 0, 34)).fetchMatchUpdate(match, new Date('2026-06-15T18:30:00.000Z'));
    expect(update).toMatchObject({
      status: 'LIVE',
      homeScore: 1,
      awayScore: 0,
      minute: 34,
      isFinal: false
    });
  });

  it('normalizes a half-time fixture response', async () => {
    const update = await providerFor(sampleFixture('HT', 1, 1, 45)).fetchMatchUpdate(match, new Date('2026-06-15T18:30:00.000Z'));
    expect(update).toMatchObject({
      status: 'HT',
      homeScore: 1,
      awayScore: 1,
      minute: 45,
      isFinal: false
    });
  });

  it('normalizes a finished fixture response as final', async () => {
    const update = await providerFor(sampleFixture('FT', 2, 1, 90)).fetchMatchUpdate(match, new Date('2026-06-15T18:30:00.000Z'));
    expect(update).toMatchObject({
      status: 'FINISHED',
      homeScore: 2,
      awayScore: 1,
      minute: 90,
      isFinal: true,
      providerUpdatedAt: '2026-06-15T20:30:00.000000Z'
    });
  });

  it('preserves unknown provider status and returns conservative warning', async () => {
    const update = await providerFor(sampleFixture('ABANDONED_REVIEW')).fetchMatchUpdate(match, new Date('2026-06-15T18:30:00.000Z'));
    expect(update).toMatchObject({
      status: 'SCHEDULED',
      rawProviderStatus: 'ABANDONED_REVIEW',
      isFinal: false,
      warning: 'Unknown provider status "ABANDONED_REVIEW" normalized conservatively to SCHEDULED.'
    });
  });

  it('parses fixture payloads without making network calls', () => {
    expect(parseSportmonksFixture(sampleFixture('FT', 3, 2, 120))).toMatchObject({
      rawStatus: 'FINISHED',
      homeScore: 3,
      awayScore: 2,
      minute: 120
    });
  });
});

function providerFor(fixture: unknown): SportmonksResultProvider {
  return new SportmonksResultProvider(config, matchMap, async (url) => ({
    ok: true,
    status: 200,
    async json() {
      expect(url).toContain('/v3/football/fixtures/12345');
      expect(url).toContain('api_token=test-key');
      return { data: fixture };
    },
    async text() {
      return '';
    }
  }));
}

function sampleFixture(shortName: string, homeScore?: number, awayScore?: number, minute?: number) {
  return {
    id: 12345,
    state: { short_name: shortName },
    minute,
    updated_at: '2026-06-15T20:30:00.000000Z',
    scores: [
      { description: 'CURRENT', score: { participant: 'home', goals: homeScore } },
      { description: 'CURRENT', score: { participant: 'away', goals: awayScore } }
    ]
  };
}
