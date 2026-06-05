import { describe, expect, it } from 'vitest';
import exampleMap from '../data/providerMatchMap.example.json' assert { type: 'json' };
import { validateProviderMatchMap, validateProviderMatchMapForLive, type ProviderMatchMapEntry } from '../server/results/providerMatchMap.js';

describe('provider match map validation', () => {
  it('accepts the documented example map', () => {
    expect(validateProviderMatchMap(exampleMap as ProviderMatchMapEntry[])).toEqual([]);
  });

  it('requires confirmed fixture ids for live provider writes', () => {
    expect(validateProviderMatchMapForLive({
      entries: exampleMap as ProviderMatchMapEntry[],
      provider: 'sportmonks',
      competitionId: '732',
      season: '2026',
      expectedInternalMatchIds: [1, 2]
    })).toEqual([
      'Provider fixture id is missing for sportmonks internal match 1.',
      'Provider fixture mapping for sportmonks internal match 1 must be confirmed before live writes.',
      'Provider fixture mapping is missing for sportmonks internal match 2.'
    ]);
  });

  it('rejects missing ids and duplicate provider/internal match pairs', () => {
    const entries: ProviderMatchMapEntry[] = [
      {
        internalMatchId: 0,
        provider: 'api-football',
        providerCompetitionId: '',
        providerSeason: '2026',
        providerFixtureId: null,
        confidence: 'low'
      },
      {
        internalMatchId: 1,
        provider: 'sportmonks',
        providerCompetitionId: '732',
        providerSeason: '2026',
        providerFixtureId: null,
        confidence: 'confirmed'
      },
      {
        internalMatchId: 1,
        provider: 'sportmonks',
        providerCompetitionId: '732',
        providerSeason: '2026',
        providerFixtureId: '123',
        confidence: 'confirmed'
      }
    ];

    expect(validateProviderMatchMap(entries)).toEqual([
      'providerMatchMap[0].internalMatchId must be a positive integer',
      'providerMatchMap[0].providerCompetitionId is required',
      'providerMatchMap[2] duplicates sportmonks:1'
    ]);
  });
});
