import { describe, expect, it } from 'vitest';
import { createResultProvider } from '../server/results/resultProviderFactory.js';
import { loadResultProviderConfig, validateResultProviderConfig } from '../server/results/resultProviderConfig.js';
import { normalizeProviderStatusDetail } from '../server/results/resultProvider.js';

describe('result provider config and factory', () => {
  it('defaults to safe mock mode without API credentials', () => {
    const config = loadResultProviderConfig({});
    expect(config).toMatchObject({ provider: 'mock', providerChain: ['mock'], writeMode: 'mock' });
    expect(validateResultProviderConfig(config)).toEqual([]);

    const provider = createResultProvider(config);
    expect(provider.name).toBe('mock-result-provider');
    expect(provider.mode).toBe('mock');
  });

  it('rejects unsupported provider names clearly', () => {
    expect(() => loadResultProviderConfig({ RESULTS_PROVIDER: 'unknown' })).toThrow(/Unsupported RESULTS_PROVIDER/);
  });

  it('fails clearly when Sportmonks mode is missing required config', () => {
    const config = loadResultProviderConfig({ RESULTS_PROVIDER: 'sportmonks' });
    expect(validateResultProviderConfig(config)).toEqual([
      'SPORTMONKS_API_KEY or RESULTS_API_KEY is required when Sportmonks is enabled',
      'SPORTMONKS_API_BASE_URL or RESULTS_API_BASE_URL is required when Sportmonks is enabled',
      'SPORTMONKS_COMPETITION_ID or RESULTS_COMPETITION_ID is required when Sportmonks is enabled',
      'SPORTMONKS_SEASON or RESULTS_SEASON is required when Sportmonks is enabled'
    ]);
    expect(() => createResultProvider(config)).toThrow(/Invalid result provider configuration/);
  });

  it('requires API-Football config only when API-Football is enabled', () => {
    const mockConfig = loadResultProviderConfig({});
    expect(validateResultProviderConfig(mockConfig)).toEqual([]);

    const apiFootballConfig = loadResultProviderConfig({ RESULTS_PROVIDER: 'api-football' });
    expect(validateResultProviderConfig(apiFootballConfig)).toEqual([
      'API_FOOTBALL_API_KEY is required when API-Football is enabled',
      'API_FOOTBALL_API_BASE_URL is required when API-Football is enabled'
    ]);
  });

  it('requires football-data.org config only when football-data is enabled', () => {
    const mockConfig = loadResultProviderConfig({});
    expect(validateResultProviderConfig(mockConfig)).toEqual([]);

    const footballDataConfig = loadResultProviderConfig({ RESULTS_PROVIDER: 'football-data' });
    expect(validateResultProviderConfig(footballDataConfig)).toEqual([
      'FOOTBALL_DATA_API_KEY is required when football-data.org is enabled',
      'FOOTBALL_DATA_API_BASE_URL is required when football-data.org is enabled'
    ]);
  });

  it('creates the Sportmonks provider when required config is present', () => {
    const provider = createResultProvider(
      loadResultProviderConfig({
        RESULTS_PROVIDER: 'sportmonks',
        SPORTMONKS_API_KEY: 'test-key',
        SPORTMONKS_API_BASE_URL: 'https://example.test',
        SPORTMONKS_COMPETITION_ID: '732',
        SPORTMONKS_SEASON: '2026'
      })
    );

    expect(provider.name).toBe('sportmonks-result-provider');
    expect(provider.mode).toBe('live');
  });

  it('creates the API-Football provider when required config is present', () => {
    const provider = createResultProvider(
      loadResultProviderConfig({
        RESULTS_PROVIDER: 'api-football',
        API_FOOTBALL_API_KEY: 'test-key',
        API_FOOTBALL_API_BASE_URL: 'https://example.test',
        API_FOOTBALL_COMPETITION_ID: 'world-cup',
        API_FOOTBALL_SEASON: '2026'
      })
    );

    expect(provider.name).toBe('api-football-result-provider');
    expect(provider.mode).toBe('live');
  });

  it('requires an agent secret before live write mode can be enabled', () => {
    const config = loadResultProviderConfig({
      RESULTS_PROVIDER: 'football-data',
      FOOTBALL_DATA_API_KEY: 'test-key',
      FOOTBALL_DATA_API_BASE_URL: 'https://example.test',
      FOOTBALL_DATA_COMPETITION_ID: 'WC',
      FOOTBALL_DATA_SEASON: '2026',
      RESULTS_WRITE_MODE: 'live'
    });

    expect(validateResultProviderConfig(config)).toContain('RESULTS_AGENT_SECRET is required when RESULTS_WRITE_MODE=live');
  });

  it('blocks Sportmonks live writes until fixture mapping is confirmed', () => {
    const config = loadResultProviderConfig({
      RESULTS_PROVIDER: 'sportmonks',
      SPORTMONKS_API_KEY: 'test-key',
      SPORTMONKS_API_BASE_URL: 'https://example.test',
      SPORTMONKS_COMPETITION_ID: '732',
      SPORTMONKS_SEASON: '2026',
      RESULTS_WRITE_MODE: 'live',
      RESULTS_AGENT_SECRET: 'secret'
    });

    expect(() => createResultProvider(config)).toThrow(/Invalid provider match map for live writes/);
  });

  it('allows Sportmonks live writes when fixture mapping is confirmed and secret is configured', () => {
    const config = loadResultProviderConfig({
      RESULTS_PROVIDER: 'sportmonks',
      SPORTMONKS_API_KEY: 'test-key',
      SPORTMONKS_API_BASE_URL: 'https://example.test',
      SPORTMONKS_COMPETITION_ID: '732',
      SPORTMONKS_SEASON: '2026',
      RESULTS_WRITE_MODE: 'live',
      RESULTS_AGENT_SECRET: 'secret'
    });

    const provider = createResultProvider(config, [{
      internalMatchId: 1,
      provider: 'sportmonks',
      providerCompetitionId: '732',
      providerSeason: '2026',
      providerFixtureId: 'fixture-1',
      confidence: 'confirmed'
    }]);

    expect(provider.name).toBe('sportmonks-result-provider');
  });

  it('creates a configured provider chain in the requested order', () => {
    const provider = createResultProvider(
      loadResultProviderConfig({
        RESULTS_PROVIDER_CHAIN: 'api-football,football-data,sportmonks',
        API_FOOTBALL_API_KEY: 'api-football-key',
        API_FOOTBALL_API_BASE_URL: 'https://api-football.example',
        FOOTBALL_DATA_API_KEY: 'football-data-key',
        FOOTBALL_DATA_API_BASE_URL: 'https://football-data.example',
        SPORTMONKS_API_KEY: 'sportmonks-key',
        SPORTMONKS_API_BASE_URL: 'https://sportmonks.example',
        SPORTMONKS_COMPETITION_ID: '732',
        SPORTMONKS_SEASON: '2026'
      })
    );

    expect(provider.name).toBe('provider-chain:api-football-result-provider,football-data-result-provider,sportmonks-result-provider');
    expect(provider.mode).toBe('live');
  });
});

describe('provider status normalization', () => {
  it('normalizes unknown statuses conservatively without marking final', () => {
    const result = normalizeProviderStatusDetail('abandoned-review');
    expect(result).toMatchObject({
      status: 'SCHEDULED',
      isFinal: false,
      warning: 'Unknown provider status "abandoned-review" normalized conservatively to SCHEDULED.'
    });
  });

  it('normalizes extra time and penalties with period metadata', () => {
    expect(normalizeProviderStatusDetail('extra-time')).toMatchObject({ status: 'ET', period: 'EXTRA_TIME', isFinal: false });
    expect(normalizeProviderStatusDetail('penalty-shootout')).toMatchObject({ status: 'PEN', period: 'PENALTIES', isFinal: false });
    expect(normalizeProviderStatusDetail('after penalties')).toMatchObject({ status: 'FINISHED', isFinal: true });
  });
});
