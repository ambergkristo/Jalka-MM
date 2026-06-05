import { describe, expect, it } from 'vitest';
import exampleMap from '../data/providerMatchMap.example.json' assert { type: 'json' };
import { validateProviderMatchMap, type ProviderMatchMapEntry } from '../server/results/providerMatchMap.js';

describe('provider match map validation', () => {
  it('accepts the documented example map', () => {
    expect(validateProviderMatchMap(exampleMap as ProviderMatchMapEntry[])).toEqual([]);
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
