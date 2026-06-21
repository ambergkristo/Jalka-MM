export type ResultsProviderName = 'mock' | 'api-football' | 'football-data' | 'sportmonks' | 'open-worldcup' | 'free-worldcup';
export type ResultsWriteMode = 'mock' | 'dry-run' | 'live';

export interface ProviderSpecificConfig {
  apiKey?: string;
  apiBaseUrl?: string;
  apiHost?: string;
  competitionId?: string;
  season?: string;
}

export interface ResultProviderConfig {
  provider: ResultsProviderName;
  providerChain: ResultsProviderName[];
  apiKey?: string;
  apiBaseUrl?: string;
  competitionId?: string;
  season?: string;
  apiFootball: ProviderSpecificConfig;
  footballData: ProviderSpecificConfig;
  sportmonks: ProviderSpecificConfig;
  openWorldCup: ProviderSpecificConfig;
  writeMode: ResultsWriteMode;
  agentSecret?: string;
  confirmationDelayMinutes?: number;
}

export function loadResultProviderConfig(env: NodeJS.ProcessEnv = process.env): ResultProviderConfig {
  const provider = parseProviderName(env.RESULTS_PROVIDER ?? 'mock');
  const providerChain = parseProviderChain(env.RESULTS_PROVIDER_CHAIN ?? provider);
  const freeWorldCupEnabled = provider === 'free-worldcup' || providerChain.includes('free-worldcup');
  const apiFootballEnabled = provider === 'api-football' || providerChain.includes('api-football');
  const footballDataEnabled = provider === 'football-data' || providerChain.includes('football-data');
  const sportmonksEnabled = provider === 'sportmonks' || providerChain.includes('sportmonks');
  return {
    provider,
    providerChain,
    apiKey: emptyToUndefined(env.RESULTS_API_KEY),
    apiBaseUrl: emptyToUndefined(env.RESULTS_API_BASE_URL),
    competitionId: emptyToUndefined(env.RESULTS_COMPETITION_ID),
    season: emptyToUndefined(env.RESULTS_SEASON),
    apiFootball: {
      apiKey: emptyToUndefined(env.API_FOOTBALL_API_KEY ?? (apiFootballEnabled ? env.RESULTS_API_KEY : undefined)),
      apiBaseUrl: emptyToUndefined(env.API_FOOTBALL_API_BASE_URL ?? (apiFootballEnabled ? env.RESULTS_API_BASE_URL : undefined)),
      apiHost: emptyToUndefined(env.API_FOOTBALL_HOST),
      competitionId: emptyToUndefined(env.API_FOOTBALL_COMPETITION_ID ?? (apiFootballEnabled ? env.RESULTS_COMPETITION_ID : undefined)),
      season: emptyToUndefined(env.API_FOOTBALL_SEASON ?? (apiFootballEnabled ? env.RESULTS_SEASON : undefined))
    },
    footballData: {
      apiKey: emptyToUndefined(env.FOOTBALL_DATA_API_KEY ?? (footballDataEnabled ? env.RESULTS_API_KEY : undefined)),
      apiBaseUrl: emptyToUndefined(env.FOOTBALL_DATA_API_BASE_URL ?? (footballDataEnabled ? env.RESULTS_API_BASE_URL : undefined)),
      competitionId: emptyToUndefined(env.FOOTBALL_DATA_COMPETITION_ID ?? (footballDataEnabled ? env.RESULTS_COMPETITION_ID : undefined) ?? (freeWorldCupEnabled ? 'WC' : undefined)),
      season: emptyToUndefined(env.FOOTBALL_DATA_SEASON ?? (footballDataEnabled ? env.RESULTS_SEASON : undefined) ?? (freeWorldCupEnabled ? '2026' : undefined))
    },
    sportmonks: {
      apiKey: emptyToUndefined(env.SPORTMONKS_API_KEY ?? (sportmonksEnabled ? env.RESULTS_API_KEY : undefined)),
      apiBaseUrl: emptyToUndefined(env.SPORTMONKS_API_BASE_URL ?? (sportmonksEnabled ? env.RESULTS_API_BASE_URL : undefined)),
      competitionId: emptyToUndefined(env.SPORTMONKS_COMPETITION_ID ?? (sportmonksEnabled ? env.RESULTS_COMPETITION_ID : undefined)),
      season: emptyToUndefined(env.SPORTMONKS_SEASON ?? (sportmonksEnabled ? env.RESULTS_SEASON : undefined))
    },
    openWorldCup: {
      apiBaseUrl: emptyToUndefined(env.OPEN_WORLDCUP_API_BASE_URL ?? (provider === 'open-worldcup' ? env.RESULTS_API_BASE_URL : undefined)),
      apiKey: emptyToUndefined(env.OPEN_WORLDCUP_API_TOKEN ?? env.OPEN_WORLDCUP_API_KEY ?? env.RESULTS_API_KEY)
    },
    writeMode: parseWriteMode(env.RESULTS_WRITE_MODE ?? 'mock'),
    agentSecret: emptyToUndefined(env.RESULTS_AGENT_SECRET),
    confirmationDelayMinutes: parseConfirmationDelayMinutes(env.RESULT_CONFIRMATION_DELAY_MINUTES ?? '10')
  };
}

export function validateResultProviderConfig(config: ResultProviderConfig): string[] {
  const errors: string[] = [];
  const enabledProviders = [...new Set(config.providerChain)];
  const freeWorldCupEnabled = enabledProviders.includes('free-worldcup');
  for (const provider of enabledProviders) {
    if (provider === 'api-football') {
      if (!config.apiFootball.apiKey) errors.push('API_FOOTBALL_API_KEY is required when API-Football is enabled');
      if (!config.apiFootball.apiBaseUrl) errors.push('API_FOOTBALL_API_BASE_URL is required when API-Football is enabled');
    }
    if (provider === 'football-data') {
      if (!config.footballData.apiKey) errors.push('FOOTBALL_DATA_API_KEY is required when football-data.org is enabled');
      if (!config.footballData.apiBaseUrl) errors.push('FOOTBALL_DATA_API_BASE_URL is required when football-data.org is enabled');
    }
    if (provider === 'sportmonks') {
      if (!config.sportmonks.apiKey) errors.push('SPORTMONKS_API_KEY or RESULTS_API_KEY is required when Sportmonks is enabled');
      if (!config.sportmonks.apiBaseUrl) errors.push('SPORTMONKS_API_BASE_URL or RESULTS_API_BASE_URL is required when Sportmonks is enabled');
      if (!config.sportmonks.competitionId) errors.push('SPORTMONKS_COMPETITION_ID or RESULTS_COMPETITION_ID is required when Sportmonks is enabled');
      if (!config.sportmonks.season) errors.push('SPORTMONKS_SEASON or RESULTS_SEASON is required when Sportmonks is enabled');
    }
    if (provider === 'open-worldcup') {
      if (!config.openWorldCup.apiBaseUrl) errors.push('OPEN_WORLDCUP_API_BASE_URL is required when open-worldcup is enabled');
    }
    if (provider === 'free-worldcup') {
      if (!config.openWorldCup.apiBaseUrl) errors.push('OPEN_WORLDCUP_API_BASE_URL is required when free-worldcup is enabled');
    }
  }
  if (freeWorldCupEnabled && hasPartialFootballDataConfig(config.footballData)) {
    if (!config.footballData.apiKey) errors.push('FOOTBALL_DATA_API_KEY is required when football-data.org verifier is configured for free-worldcup');
    if (!config.footballData.apiBaseUrl) errors.push('FOOTBALL_DATA_API_BASE_URL is required when football-data.org verifier is configured for free-worldcup');
  }
  if (config.writeMode === 'live' && !config.agentSecret) {
    errors.push('RESULTS_AGENT_SECRET is required when RESULTS_WRITE_MODE=live');
  }
  if (enabledProviders.every((provider) => provider === 'mock') && config.writeMode === 'live') {
    errors.push('RESULTS_WRITE_MODE=live cannot be used with only mock providers');
  }
  return errors;
}

function parseProviderName(value: string): ResultsProviderName {
  if (value === 'mock' || value === 'api-football' || value === 'football-data' || value === 'sportmonks' || value === 'open-worldcup' || value === 'free-worldcup') return value;
  throw new Error(`Unsupported RESULTS_PROVIDER "${value}". Use mock, api-football, football-data, sportmonks, open-worldcup, or free-worldcup.`);
}

function parseWriteMode(value: string): ResultsWriteMode {
  if (value === 'mock' || value === 'dry-run' || value === 'live') return value;
  throw new Error(`Unsupported RESULTS_WRITE_MODE "${value}". Use mock, dry-run, or live.`);
}

function parseProviderChain(value: string): ResultsProviderName[] {
  const providers = value.split(',').map((part) => part.trim()).filter(Boolean).map(parseProviderName);
  return providers.length > 0 ? providers : ['mock'];
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function hasPartialFootballDataConfig(config: ProviderSpecificConfig): boolean {
  return Boolean(config.apiKey || config.apiBaseUrl);
}

function parseConfirmationDelayMinutes(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid RESULT_CONFIRMATION_DELAY_MINUTES "${value}". Use a non-negative number.`);
  return parsed;
}
