export type ProviderMatchConfidence = 'example' | 'low' | 'medium' | 'high' | 'confirmed';
export type ProviderMatchMapProvider = 'api-football' | 'football-data' | 'sportmonks';

export interface ProviderMatchMapEntry {
  internalMatchId: number;
  provider: ProviderMatchMapProvider;
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

export function findProviderMatchMapEntry(input: {
  entries: ProviderMatchMapEntry[];
  provider: ProviderMatchMapProvider;
  internalMatchId: number;
  competitionId?: string;
  season?: string;
}): ProviderMatchMapEntry | undefined {
  return input.entries.find(
    (entry) =>
      entry.provider === input.provider &&
      entry.internalMatchId === input.internalMatchId &&
      (!input.competitionId || entry.providerCompetitionId === input.competitionId) &&
      (!input.season || entry.providerSeason === input.season)
  );
}

export function validateProviderMatchMapForLive(input: {
  entries: ProviderMatchMapEntry[];
  provider: ProviderMatchMapProvider;
  competitionId?: string;
  season?: string;
  expectedInternalMatchIds?: number[];
}): string[] {
  const structuralErrors = validateProviderMatchMap(input.entries);
  const rows = input.entries.filter(
    (entry) =>
      entry.provider === input.provider &&
      (!input.competitionId || entry.providerCompetitionId === input.competitionId) &&
      (!input.season || entry.providerSeason === input.season)
  );
  const errors = [...structuralErrors];

  if (rows.length === 0) errors.push(`No provider match map entries found for ${input.provider}.`);
  for (const entry of rows) {
    if (!entry.providerFixtureId) errors.push(`Provider fixture id is missing for ${input.provider} internal match ${entry.internalMatchId}.`);
    if (entry.confidence !== 'confirmed') errors.push(`Provider fixture mapping for ${input.provider} internal match ${entry.internalMatchId} must be confirmed before live writes.`);
  }

  for (const matchId of input.expectedInternalMatchIds ?? []) {
    const entry = rows.find((candidate) => candidate.internalMatchId === matchId);
    if (!entry) errors.push(`Provider fixture mapping is missing for ${input.provider} internal match ${matchId}.`);
  }

  return [...new Set(errors)];
}
