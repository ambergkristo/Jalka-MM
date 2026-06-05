import type { ResultsProviderName } from './resultProviderConfig.js';

export type ProviderMatchConfidence = 'example' | 'low' | 'medium' | 'high' | 'confirmed';

export interface ProviderMatchMapEntry {
  internalMatchId: number;
  provider: Exclude<ResultsProviderName, 'mock'>;
  providerCompetitionId: string;
  providerSeason: string;
  providerFixtureId?: string | null;
  confidence: ProviderMatchConfidence;
  notes?: string;
}

export function validateProviderMatchMap(entries: ProviderMatchMapEntry[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const [index, entry] of entries.entries()) {
    const prefix = `providerMatchMap[${index}]`;
    if (!Number.isInteger(entry.internalMatchId) || entry.internalMatchId <= 0) errors.push(`${prefix}.internalMatchId must be a positive integer`);
    if (!['api-football', 'football-data', 'sportmonks'].includes(entry.provider)) errors.push(`${prefix}.provider is unsupported`);
    if (!entry.providerCompetitionId.trim()) errors.push(`${prefix}.providerCompetitionId is required`);
    if (!entry.providerSeason.trim()) errors.push(`${prefix}.providerSeason is required`);
    if (!['example', 'low', 'medium', 'high', 'confirmed'].includes(entry.confidence)) errors.push(`${prefix}.confidence is invalid`);

    const key = `${entry.provider}:${entry.internalMatchId}`;
    if (seen.has(key)) errors.push(`${prefix} duplicates ${key}`);
    seen.add(key);
  }

  return errors;
}
