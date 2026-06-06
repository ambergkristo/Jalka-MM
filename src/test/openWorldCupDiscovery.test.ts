import { describe, expect, it } from 'vitest';
import matchesSeed from '../data/worldcup2026/matches.json' with { type: 'json' };
import {
  buildCandidateFixture,
  buildTeamLookup,
  resolveTeamLabel,
  summarizeConfidenceSummary
} from '../tools/discoverOpenWorldCup.js';

describe('open worldcup discovery helpers', () => {
  it('resolves numeric team ids through the hosted team list', () => {
    const teams = buildTeamLookup([
      { id: '1', name_en: 'Mexico' },
      { id: '2', name_en: 'South Africa', fifa_code: 'RSA' }
    ]);

    expect(resolveTeamLabel('1', undefined, teams)).toBe('Mexico');
    expect(resolveTeamLabel('2', 'Fallback', teams)).toBe('South Africa');
    expect(resolveTeamLabel('999', 'Fallback', teams)).toBe('Fallback');
  });

  it('builds a high-confidence fixture candidate when kickoff and names match', () => {
    const teamLookup = buildTeamLookup([
      { id: '1', name_en: 'Mexico' },
      { id: '2', name_en: 'South Africa' }
    ]);

    const candidate = buildCandidateFixture(
      {
        id: '1',
        home_team_id: '1',
        away_team_id: '2',
        local_date: '06/11/2026 19:00',
        status: 'LIVE',
        home_score: '0',
        away_score: '0'
      },
      matchesSeed.slice(0, 1),
      teamLookup
    );

    expect(candidate).toMatchObject({
      providerFixtureId: '1',
      homeTeam: 'Mexico',
      awayTeam: 'South Africa',
      matchedInternalMatchId: 1,
      confidence: 'medium'
    });
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
