const scorerTeamByNormalizedName: Record<string, string> = {
  'kylian mbappe': 'Prantsusmaa',
  mbappe: 'Prantsusmaa',
  'k mbappe': 'Prantsusmaa',
  'ousmane dembele': 'Prantsusmaa',
  'erling haaland': 'Norra',
  haaland: 'Norra',
  'harry kane': 'Inglismaa',
  kane: 'Inglismaa',
  'lionel messi': 'Argentina',
  messi: 'Argentina',
  'julian alvarez': 'Argentina',
  'vinicius jr': 'Brasiilia',
  'vinicius junior': 'Brasiilia',
  'vini jr': 'Brasiilia',
  'cristiano ronaldo': 'Portugal',
  'c ronaldo': 'Portugal',
  ronaldo: 'Portugal',
  'lamine yamal': 'Hispaania',
  yamal: 'Hispaania',
  'ferran torres': 'Hispaania',
  'santiago gimenez': 'Mehhiko',
  'jonathan david': 'Kanada',
  'alphonso davies': 'Kanada',
  'son heung min': 'Lõuna-Korea',
  'patrik schick': 'Tšehhi'
};

export function resolveScorerTeam(playerName: string | undefined, importedTeam: string | undefined): string {
  const knownImportedTeam = importedTeam && importedTeam !== 'Unknown team' ? importedTeam : undefined;
  if (knownImportedTeam) return knownImportedTeam;
  const normalized = normalizeScorerName(playerName);
  return normalized ? scorerTeamByNormalizedName[normalized] ?? 'Võistkond teadmata' : 'Võistkond teadmata';
}

export function normalizeScorerName(value: string | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\./g, ' ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}
