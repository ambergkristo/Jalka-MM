export type ResultsProviderName = 'mock' | 'api-football' | 'football-data' | 'sportmonks';
export type ResultsWriteMode = 'mock' | 'dry-run' | 'live';

export interface ResultProviderConfig {
  provider: ResultsProviderName;
  apiKey?: string;
  apiBaseUrl?: string;
  competitionId?: string;
  season?: string;
  writeMode: ResultsWriteMode;
  agentSecret?: string;
  confirmationDelayMinutes?: number;
}

export function loadResultProviderConfig(env: NodeJS.ProcessEnv = process.env): ResultProviderConfig {
  return {
    provider: parseProviderName(env.RESULTS_PROVIDER ?? 'mock'),
    apiKey: emptyToUndefined(env.RESULTS_API_KEY),
    apiBaseUrl: emptyToUndefined(env.RESULTS_API_BASE_URL),
    competitionId: emptyToUndefined(env.RESULTS_COMPETITION_ID),
    season: emptyToUndefined(env.RESULTS_SEASON),
    writeMode: parseWriteMode(env.RESULTS_WRITE_MODE ?? 'mock'),
    agentSecret: emptyToUndefined(env.RESULTS_AGENT_SECRET),
    confirmationDelayMinutes: parseConfirmationDelayMinutes(env.RESULT_CONFIRMATION_DELAY_MINUTES ?? '10')
  };
}

export function validateResultProviderConfig(config: ResultProviderConfig): string[] {
  const errors: string[] = [];
  if (config.provider !== 'mock') {
    if (!config.apiKey) errors.push('RESULTS_API_KEY is required when RESULTS_PROVIDER is not mock');
    if (!config.apiBaseUrl) errors.push('RESULTS_API_BASE_URL is required when RESULTS_PROVIDER is not mock');
    if (!config.competitionId) errors.push('RESULTS_COMPETITION_ID is required when RESULTS_PROVIDER is not mock');
    if (!config.season) errors.push('RESULTS_SEASON is required when RESULTS_PROVIDER is not mock');
  }
  if (config.writeMode === 'live' && !config.agentSecret) {
    errors.push('RESULTS_AGENT_SECRET is required when RESULTS_WRITE_MODE=live');
  }
  if (config.provider === 'mock' && config.writeMode === 'live') {
    errors.push('RESULTS_WRITE_MODE=live cannot be used with RESULTS_PROVIDER=mock');
  }
  return errors;
}

function parseProviderName(value: string): ResultsProviderName {
  if (value === 'mock' || value === 'api-football' || value === 'football-data' || value === 'sportmonks') return value;
  throw new Error(`Unsupported RESULTS_PROVIDER "${value}". Use mock, api-football, football-data, or sportmonks.`);
}

function parseWriteMode(value: string): ResultsWriteMode {
  if (value === 'mock' || value === 'dry-run' || value === 'live') return value;
  throw new Error(`Unsupported RESULTS_WRITE_MODE "${value}". Use mock, dry-run, or live.`);
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseConfirmationDelayMinutes(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid RESULT_CONFIRMATION_DELAY_MINUTES "${value}". Use a non-negative number.`);
  return parsed;
}
