import teamsJson from '../data/worldcup2026/teams.json' with { type: 'json' };

interface TeamSeed {
  id: string;
  code: string;
  name: string;
  nameEt?: string;
  name_et?: string;
}

export interface CanonicalTeamIdentity {
  id: string;
  code: string;
  name: string;
  displayName: string;
}

const seededTeams = teamsJson as TeamSeed[];
const aliasEntries: Array<[string, string]> = [
  ['Argentiina', 'Argentina'],
  ['Bosnia', 'Bosnia and Herzegovina'],
  ['Bosnia-Herzegovina', 'Bosnia and Herzegovina'],
  ['Bosnia and Herzegovina', 'Bosnia and Herzegovina'],
  ['Cabo Verde', 'Cabo Verde'],
  ['Cape Verde', 'Cabo Verde'],
  ['Colombia', 'Colombia'],
  ['Congo DR', 'Congo DR'],
  ['DR Congo', 'Congo DR'],
  ['Curacao', 'Curaçao'],
  ['Curaçao', 'Curaçao'],
  ['Cote dIvoire', 'Côte d’Ivoire'],
  ['Cote d Ivoire', 'Côte d’Ivoire'],
  ["Cote d'Ivoire", 'Côte d’Ivoire'],
  ['Ivory Coast', 'Côte d’Ivoire'],
  ['Czech Republic', 'Czechia'],
  ['Czechia', 'Czechia'],
  ['Germany', 'Germany'],
  ['Iran', 'IR Iran'],
  ['IR Iran', 'IR Iran'],
  ['Kolumbia', 'Colombia'],
  ['Kongo DV', 'Congo DR'],
  ['Korea Republic', 'Korea Republic'],
  ['LAV', 'South Africa'],
  ['Lõuna Aafrika Vabariik', 'South Africa'],
  ['Lõuna-Aafrika', 'South Africa'],
  ['Lõuna-Aafrika Vabariik', 'South Africa'],
  ['Paraguai', 'Paraguay'],
  ['Paraguay', 'Paraguay'],
  ['Saudi Arabia', 'Saudi Arabia'],
  ['South Africa', 'South Africa'],
  ['South Korea', 'Korea Republic'],
  ['Turkey', 'Türkiye'],
  ['Turkiye', 'Türkiye'],
  ['UAE', 'United Arab Emirates'],
  ['United Arab Emirates', 'United Arab Emirates'],
  ['United States', 'USA'],
  ['USA', 'USA'],
  ['Usbekistan', 'Uzbekistan'],
  ['Uzbekistan', 'Uzbekistan']
];

const teamByLookupKey = buildTeamLookup();

export function resolveCanonicalTeam(value: string): CanonicalTeamIdentity | undefined {
  return teamByLookupKey.get(normalizeTeamName(value));
}

export function canonicalTeamName(value: string): string {
  return resolveCanonicalTeam(value)?.displayName ?? value.trim();
}

export function sameTeamName(left: string, right: string): boolean {
  return normalizeTeamName(left) === normalizeTeamName(right);
}

export function normalizeTeamName(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[’'`]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return aliasToLookupKey.get(normalized) ?? normalized;
}

function buildTeamLookup(): Map<string, CanonicalTeamIdentity> {
  const lookup = new Map<string, CanonicalTeamIdentity>();
  for (const team of seededTeams) {
    const canonical = toCanonicalTeam(team);
    registerTeamName(lookup, team.code, canonical);
    registerTeamName(lookup, team.name, canonical);
    registerTeamName(lookup, team.nameEt, canonical);
    registerTeamName(lookup, team.name_et, canonical);
  }

  for (const [alias, canonicalName] of aliasEntries) {
    const canonicalTeam = seededTeams.find((team) => team.name === canonicalName || team.nameEt === canonicalName || team.name_et === canonicalName);
    if (!canonicalTeam) continue;
    registerTeamName(lookup, alias, toCanonicalTeam(canonicalTeam));
  }

  return lookup;
}

function toCanonicalTeam(team: TeamSeed): CanonicalTeamIdentity {
  return {
    id: team.id,
    code: team.code,
    name: team.name,
    displayName: team.nameEt ?? team.name_et ?? team.name
  };
}

function registerTeamName(
  lookup: Map<string, CanonicalTeamIdentity>,
  value: string | undefined,
  team: CanonicalTeamIdentity
): void {
  if (!value) return;
  lookup.set(normalizeBaseTeamName(value), team);
}

function normalizeBaseTeamName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[’'`]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const aliasToLookupKey = new Map(
  aliasEntries.map(([alias, canonicalName]) => [normalizeBaseTeamName(alias), normalizeBaseTeamName(canonicalName)])
);
