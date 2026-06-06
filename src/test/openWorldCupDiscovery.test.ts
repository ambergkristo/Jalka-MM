import { describe, expect, it } from 'vitest';
import matchesSeed from '../data/worldcup2026/matches.json' with { type: 'json' };
import {
  buildCandidateFixture,
  buildUnmatchedReport,
  buildTeamLookup,
  canonicalizeWorldCupTeamName,
  resolveTeamLabel,
  summarizeConfidenceSummary
} from '../tools/discoverOpenWorldCup.js';

describe('open worldcup discovery helpers', () => {
  it('canonicalizes explicit provider aliases to internal schedule names', () => {
    expect(canonicalizeWorldCupTeamName('South Korea')).toBe('Korea Republic');
    expect(canonicalizeWorldCupTeamName('Czech Republic')).toBe('Czechia');
    expect(canonicalizeWorldCupTeamName('United States')).toBe('USA');
    expect(canonicalizeWorldCupTeamName('Iran')).toBe('IR Iran');
    expect(canonicalizeWorldCupTeamName('Cape Verde')).toBe('Cabo Verde');
    expect(canonicalizeWorldCupTeamName('Ivory Coast')).toBe('Cote d Ivoire');
    expect(canonicalizeWorldCupTeamName('Turkey')).toBe('Turkiye');
    expect(canonicalizeWorldCupTeamName('Curacao')).toBe('Curacao');
  });

  it('resolves numeric team ids through the hosted team list', () => {
    const teams = buildTeamLookup([
      { id: '1', name_en: 'Mexico' },
      { id: '2', name_en: 'South Africa', fifa_code: 'RSA' }
    ]);

    expect(resolveTeamLabel('1', undefined, teams)).toBe('Mexico');
    expect(resolveTeamLabel('2', 'Fallback', teams)).toBe('South Africa');
    expect(resolveTeamLabel('999', 'Fallback', teams)).toBe('Fallback');
  });

  it('builds a high-confidence fixture candidate when aliases match the internal schedule', () => {
    const teamLookup = buildTeamLookup([
      { id: '3', name_en: 'South Korea' },
      { id: '4', name_en: 'Czech Republic' }
    ]);

    const candidate = buildCandidateFixture(
      {
        id: '2',
        home_team_id: '3',
        away_team_id: '4',
        local_date: '06/11/2026 17:00',
        status: 'LIVE',
        home_score: '0',
        away_score: '0'
      },
      matchesSeed.slice(0, 4),
      teamLookup
    );

    expect(candidate).toMatchObject({
      providerFixtureId: '2',
      homeTeam: 'Korea Republic',
      awayTeam: 'Czechia',
      matchedInternalMatchId: 2,
      closestInternalMatchId: 2,
      confidence: 'high'
    });
  });

  it('reports unmatched rows with a concise reason', () => {
    expect(
      buildUnmatchedReport([
        {
          providerFixtureId: '99',
          kickoffUtc: '2026-06-21T14:00:00.000Z',
          homeTeam: 'Winner Match 91',
          awayTeam: 'Winner Match 92',
          closestInternalMatchId: 99,
          confidence: 'low',
          notes: 'no confident schedule match found'
        }
      ])
    ).toEqual([
      {
        providerFixtureId: '99',
        kickoffUtc: '2026-06-21T14:00:00.000Z',
        homeTeam: 'Winner Match 91',
        awayTeam: 'Winner Match 92',
        closestInternalMatchId: 99,
        reason: 'missing internal match'
      }
    ]);
  });

  it('summarizes confidence counts and unmatched rows', () => {
    expect(
      summarizeConfidenceSummary([
        { confidence: 'high', matchedInternalMatchId: 1 },
        { confidence: 'medium' },
        { confidence: 'low' }
      ])
    ).toEqual({ high: 1, medium: 1, low: 1, unmatched: 2 });
  });
});
