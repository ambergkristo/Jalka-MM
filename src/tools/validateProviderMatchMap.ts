import providerMatchMapSeed from '../data/providerMatchMap.example.json' with { type: 'json' };
import matchesSeed from '../data/worldcup2026/matches.json' with { type: 'json' };
import { loadResultProviderConfig } from '../server/results/resultProviderConfig.js';
import { validateProviderMatchMap, validateProviderMatchMapForLive, type ProviderMatchMapEntry, type ProviderMatchMapProvider } from '../server/results/providerMatchMap.js';

const config = loadResultProviderConfig();
const entries = providerMatchMapSeed as ProviderMatchMapEntry[];
const structuralErrors = validateProviderMatchMap(entries);
const mappedProvider = toMappedProvider(config.provider);
const liveErrors = !mappedProvider
  ? []
  : validateProviderMatchMapForLive({
      entries,
      provider: mappedProvider,
      competitionId: config.competitionId,
      season: config.season,
      expectedInternalMatchIds: config.writeMode === 'live' ? matchesSeed.map((match) => Number(match.id)) : undefined
    });
const errors = [...structuralErrors, ...liveErrors];

if (errors.length > 0) {
  console.error(JSON.stringify({
    status: 'failed',
    provider: config.provider,
    writeMode: config.writeMode,
    errors
  }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    status: 'ok',
    provider: config.provider,
    writeMode: config.writeMode,
    entries: entries.length
  }, null, 2));
}

function toMappedProvider(provider: string): ProviderMatchMapProvider | undefined {
  if (provider === 'api-football' || provider === 'football-data' || provider === 'sportmonks') return provider;
  return undefined;
}
