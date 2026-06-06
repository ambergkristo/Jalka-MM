import teamsJson from '../../data/worldcup2026/teams.json';

interface TeamSeed {
  code: string;
  name: string;
  nameEt?: string;
  name_et?: string;
}

interface TeamDisplay {
  name: string;
  code?: string;
}

const seededTeams = teamsJson as TeamSeed[];
const supplementalTeams: TeamSeed[] = [
  { code: 'UAE', name: 'United Arab Emirates', nameEt: 'AÜE' },
  { code: 'UAE', name: 'UAE', nameEt: 'AÜE' },
  { code: 'CHI', name: 'Chile', nameEt: 'Tšiili' },
  { code: 'CRC', name: 'Costa Rica', nameEt: 'Costa Rica' },
  { code: 'DEN', name: 'Denmark', nameEt: 'Taani' },
  { code: 'JAM', name: 'Jamaica', nameEt: 'Jamaica' },
  { code: 'MLI', name: 'Mali', nameEt: 'Mali' },
  { code: 'POL', name: 'Poland', nameEt: 'Poola' },
  { code: 'SRB', name: 'Serbia', nameEt: 'Serbia' }
];
const lookupTeams = [...seededTeams, ...supplementalTeams];

const aliasByName: Record<string, string> = {
  'Bosnia and Herzegovina': 'Bosnia and Herzegovina',
  Bosnia: 'Bosnia and Herzegovina',
  'Cabo Verde': 'Cabo Verde',
  'Cape Verde': 'Cabo Verde',
  'Congo DR': 'Congo DR',
  'DR Congo': 'Congo DR',
  'Cote dIvoire': 'Côte d’Ivoire',
  'Cote d Ivoire': 'Côte d’Ivoire',
  'Côte d’Ivoire': 'Côte d’Ivoire',
  'Ivory Coast': 'Côte d’Ivoire',
  Curacao: 'Curaçao',
  Curaçao: 'Curaçao',
  Czechia: 'Czechia',
  'Czech Republic': 'Czechia',
  Germany: 'Germany',
  Haiti: 'Haiti',
  Iran: 'IR Iran',
  'IR Iran': 'IR Iran',
  'Korea Republic': 'Korea Republic',
  'South Korea': 'Korea Republic',
  'Saudi Arabia': 'Saudi Arabia',
  Scotland: 'Scotland',
  Sweden: 'Sweden',
  Türkiye: 'Türkiye',
  Turkey: 'Türkiye',
  Turkiye: 'Türkiye',
  UAE: 'UAE',
  'United Arab Emirates': 'UAE',
  USA: 'USA',
  'United States': 'USA',
  Uzbekistan: 'Uzbekistan'
};

const teamByNormalizedName = new Map<string, TeamDisplay>();

for (const team of lookupTeams) {
  registerTeam(team.name, team);
  registerTeam(team.nameEt ?? team.name_et, team);
}

for (const [alias, canonicalName] of Object.entries(aliasByName)) {
  const team = lookupTeams.find((candidate) => candidate.name === canonicalName);
  if (team) registerTeam(alias, team);
}

export function teamFromName(name: string): TeamDisplay {
  return teamByNormalizedName.get(normalizeTeamName(name)) ?? { name };
}

export function displayTeamName(name: string): string {
  return teamFromName(name).name;
}

function registerTeam(name: string | undefined, team: TeamSeed): void {
  if (!name) return;
  teamByNormalizedName.set(normalizeTeamName(name), {
    name: team.nameEt ?? team.name_et ?? team.name,
    code: team.code
  });
}

function normalizeTeamName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[’']/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}
