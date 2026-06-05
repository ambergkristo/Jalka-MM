import { describe, expect, it } from 'vitest';
import { createResultProvider } from '../server/results/resultProviderFactory.js';
import { loadResultProviderConfig, validateResultProviderConfig } from '../server/results/resultProviderConfig.js';
import { normalizeProviderStatusDetail } from '../server/results/resultProvider.js';

describe('result provider config and factory', () => {
  it('defaults to safe mock mode without API credentials', () => {
    const config = loadResultProviderConfig({});
    expect(config).toMatchObject({ provider: 'mock', writeMode: 'mock' });
    expect(validateResultProviderConfig(config)).toEqual([]);

    const provider = createResultProvider(config);
    expect(provider.name).toBe('mock-result-provider');
    expect(provider.mode).toBe('mock');
  });

  it('rejects unsupported provider names clearly', () => {
    expect(() => loadResultProviderConfig({ RESULTS_PROVIDER: 'unknown' })).toThrow(/Unsupported RESULTS_PROVIDER/);
  });

  it('fails clearly when real provider mode is missing required config', () => {
    const config = loadResultProviderConfig({ RESULTS_PROVIDER: 'api-football' });
    expect(validateResultProviderConfig(config)).toEqual([
      'RESULTS_API_KEY is required when RESULTS_PROVIDER is not mock',
      'RESULTS_API_BASE_URL is required when RESULTS_PROVIDER is not mock',
      'RESULTS_COMPETITION_ID is required when RESULTS_PROVIDER is not mock',
      'RESULTS_SEASON is required when RESULTS_PROVIDER is not mock'
    ]);
    expect(() => createResultProvider(config)).toThrow(/Invalid result provider configuration/);
  });

  it('creates a deferred real-provider stub when required config is present', () => {
    const provider = createResultProvider(
      loadResultProviderConfig({
        RESULTS_PROVIDER: 'sportmonks',
        RESULTS_API_KEY: 'test-key',
        RESULTS_API_BASE_URL: 'https://example.test',
        RESULTS_COMPETITION_ID: '732',
        RESULTS_SEASON: '2026'
      })
    );

    expect(provider.name).toBe('sportmonks-result-provider');
    expect(provider.mode).toBe('live');
  });

  it('requires an agent secret before live write mode can be enabled', () => {
    const config = loadResultProviderConfig({
      RESULTS_PROVIDER: 'football-data',
      RESULTS_API_KEY: 'test-key',
      RESULTS_API_BASE_URL: 'https://example.test',
      RESULTS_COMPETITION_ID: 'WC',
      RESULTS_SEASON: '2026',
      RESULTS_WRITE_MODE: 'live'
    });

    expect(validateResultProviderConfig(config)).toContain('RESULTS_AGENT_SECRET is required when RESULTS_WRITE_MODE=live');
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
