import type { MatchResult } from '../domain/types.js';

export interface NormalizedMatchResult extends MatchResult {
  source: string;
  updatedAt: string;
}

export interface ExternalFootballResultProvider {
  name: string;
  fetchResults(): Promise<NormalizedMatchResult[]>;
}

export class ManualResultProvider implements ExternalFootballResultProvider {
  name = 'manual';

  constructor(private readonly readManualResults: () => Promise<NormalizedMatchResult[]>) {}

  fetchResults(): Promise<NormalizedMatchResult[]> {
    return this.readManualResults();
  }
}

export const providerPlaceholders = {
  API_FOOTBALL_KEY: '',
  FOOTBALL_DATA_ORG_TOKEN: '',
  SPORTMONKS_TOKEN: '',
  LIVESCORE_API_KEY: ''
};
