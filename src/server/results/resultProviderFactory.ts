import providerMatchMapSeed from '../../data/providerMatchMap.example.json' with { type: 'json' };
import { ApiFootballResultProvider } from './apiFootballResultProvider.js';
import { FootballDataResultProvider } from './footballDataResultProvider.js';
import { MockResultProvider } from './mockResultProvider.js';
import { validateProviderMatchMapForLive, type ProviderMatchMapEntry } from './providerMatchMap.js';
import { ProviderChainResultProvider } from './providerChainResultProvider.js';
import type { ResultProvider } from './resultProvider.js';
import { loadResultProviderConfig, validateResultProviderConfig, type ProviderSpecificConfig, type ResultProviderConfig, type ResultsProviderName } from './resultProviderConfig.js';
import { OpenWorldCupResultProvider } from './openWorldCupResultProvider.js';
import { SportmonksResultProvider } from './sportmonksResultProvider.js';

export function createResultProvider(
  config: ResultProviderConfig = loadResultProviderConfig(),
  matchMap: ProviderMatchMapEntry[] = providerMatchMapSeed as ProviderMatchMapEntry[]
): ResultProvider {
  const errors = validateResultProviderConfig(config);
  if (errors.length > 0) throw new Error(`Invalid result provider configuration: ${errors.join('; ')}`);
  if (config.writeMode === 'live') validateLiveMatchMaps(config, matchMap);
  const providers = config.providerChain.map((provider) => createSingleProvider(provider, config, matchMap));
  return providers.length === 1 ? providers[0] : new ProviderChainResultProvider(providers);
}

function createSingleProvider(provider: ResultsProviderName, config: ResultProviderConfig, matchMap: ProviderMatchMapEntry[]): ResultProvider {
  if (provider === 'mock') return new MockResultProvider();
  if (provider === 'api-football') return new ApiFootballResultProvider(config.apiFootball, matchMap);
  if (provider === 'football-data') return new FootballDataResultProvider(config.footballData, matchMap);
  if (provider === 'open-worldcup') return new OpenWorldCupResultProvider(config.openWorldCup);
  return new SportmonksResultProvider(providerScopedConfig(config, config.sportmonks), matchMap);
}

function validateLiveMatchMaps(config: ResultProviderConfig, matchMap: ProviderMatchMapEntry[]): void {
  const providers = [...new Set(config.providerChain.filter((provider) => provider !== 'mock' && provider !== 'open-worldcup'))];
  const errors = providers.flatMap((provider) => {
    const providerConfig = providerConfigFor(provider, config);
    return validateProviderMatchMapForLive({
      entries: matchMap,
      provider,
      competitionId: providerConfig.competitionId,
      season: providerConfig.season
    }).map((error) => `${provider}: ${error}`);
  });
  if (errors.length > 0) throw new Error(`Invalid provider match map for live writes: ${errors.join('; ')}`);
}

function providerConfigFor(provider: Exclude<ResultsProviderName, 'mock'>, config: ResultProviderConfig): ProviderSpecificConfig {
  if (provider === 'api-football') return config.apiFootball;
  if (provider === 'football-data') return config.footballData;
  if (provider === 'open-worldcup') return config.openWorldCup;
  return config.sportmonks;
}

function providerScopedConfig(config: ResultProviderConfig, providerConfig: ProviderSpecificConfig): ResultProviderConfig {
  return {
    ...config,
    apiKey: providerConfig.apiKey,
    apiBaseUrl: providerConfig.apiBaseUrl,
    competitionId: providerConfig.competitionId,
    season: providerConfig.season
  };
}
