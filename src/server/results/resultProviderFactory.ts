import providerMatchMapSeed from '../../data/providerMatchMap.example.json' with { type: 'json' };
import { MockResultProvider } from './mockResultProvider.js';
import type { ProviderMatchMapEntry } from './providerMatchMap.js';
import { RealResultProviderStub } from './realResultProviderStub.js';
import type { ResultProvider } from './resultProvider.js';
import { loadResultProviderConfig, validateResultProviderConfig, type ResultProviderConfig } from './resultProviderConfig.js';
import { SportmonksResultProvider } from './sportmonksResultProvider.js';

export function createResultProvider(
  config: ResultProviderConfig = loadResultProviderConfig(),
  matchMap: ProviderMatchMapEntry[] = providerMatchMapSeed as ProviderMatchMapEntry[]
): ResultProvider {
  const errors = validateResultProviderConfig(config);
  if (errors.length > 0) throw new Error(`Invalid result provider configuration: ${errors.join('; ')}`);
  if (config.provider === 'mock') return new MockResultProvider();
  if (config.provider === 'sportmonks') return new SportmonksResultProvider(config, matchMap);
  return new RealResultProviderStub(config);
}
