import { MockResultProvider } from './mockResultProvider.js';
import { RealResultProviderStub } from './realResultProviderStub.js';
import type { ResultProvider } from './resultProvider.js';
import { loadResultProviderConfig, validateResultProviderConfig, type ResultProviderConfig } from './resultProviderConfig.js';

export function createResultProvider(config: ResultProviderConfig = loadResultProviderConfig()): ResultProvider {
  const errors = validateResultProviderConfig(config);
  if (errors.length > 0) throw new Error(`Invalid result provider configuration: ${errors.join('; ')}`);
  if (config.provider === 'mock') return new MockResultProvider();
  return new RealResultProviderStub(config);
}
