import { describe, expect, it } from 'vitest';
import { buildCandidateFile, findBestInternalMatch, loadDiscoveryConfig, runApiFootballDiscovery } from '../tools/discoverApiFootball.js';

describe('API-Football discovery helpers', () => {
  it('classifies an exact World Cup 2026 kickoff and team-name match as high confidence', () => {
    const match = findBestInternalMatch({
      kickoffUtc: '2026-06-11T19:00:00.000Z',
      homeTeam: 'Mexico',
      awayTeam: 'South Africa'
    });

    expect(match).toMatchObject({
      matchedInternalMatchId: 1,
      confidence: 'high'
    });
  });

  it('produces a candidate file summary from discovery fixtures', () => {
    const file = buildCandidateFile({
      leagueAccessible: true,
      league: {
        name: 'FIFA World Cup',
        country: 'World',
        coverage: {
          standings: true,
          top_scorers: true
        }
      },
      fixtures: [{
        provider: 'api-football',
        providerFixtureId: '1001',
        kickoffUtc: '2026-06-11T19:00:00.000Z',
        homeTeam: 'Mexico',
        awayTeam: 'South Africa',
        rawStatus: 'NS',
        matchedInternalMatchId: 1,
        confidence: 'high',
        notes: 'kickoff and both team names matched'
      }]
    });

    expect(file).toMatchObject({
      provider: 'api-football',
      league: 1,
      season: 2026,
      leagueAccessible: true,
      fixturesFound: 1,
      confidenceSummary: { high: 1, medium: 0, low: 0 }
    });
  });

  it('fails clearly when the API key is missing', async () => {
    expect(() => loadDiscoveryConfig({})).not.toThrow();
    await expect(runApiFootballDiscovery({
      API_FOOTBALL_API_BASE_URL: 'https://v3.football.api-sports.io'
    })).rejects.toThrow('API_FOOTBALL_API_KEY is required for npm run api-football:discover');
  });
});
