const scorerTeamByNormalizedName: Record<string, string> = {
  'kylian mbappe': 'Prantsusmaa',
  mbappe: 'Prantsusmaa',
  'k mbappe': 'Prantsusmaa',
  'kylian mpabbe': 'Prantsusmaa',
  'ousmane dembele': 'Prantsusmaa',
  'michael olise': 'Prantsusmaa',
  'erling haaland': 'Norra',
  haaland: 'Norra',
  'haaland norra': 'Norra',
  'harry kane': 'Inglismaa',
  kane: 'Inglismaa',
  'jude bellingham': 'Inglismaa',
  bellingham: 'Inglismaa',
  'lionel messi': 'Argentina',
  messi: 'Argentina',
  'julian alvarez': 'Argentina',
  'lautaro martinez': 'Argentina',
  'david villa': 'Hispaania',
  'vinicius jr': 'Brasiilia',
  'vinicius junior': 'Brasiilia',
  'vini jr': 'Brasiilia',
  neymar: 'Brasiilia',
  'neymar jr': 'Brasiilia',
  raphinha: 'Brasiilia',
  'cristiano ronaldo': 'Portugal',
  'c ronaldo': 'Portugal',
  ronaldo: 'Portugal',
  'lamine yamal': 'Hispaania',
  yamal: 'Hispaania',
  pedri: 'Hispaania',
  'mikel oyarzabal': 'Hispaania',
  'mikiel oyarzabal': 'Hispaania',
  'ferran torres': 'Hispaania',
  'mohamed salah': 'Egiptus',
  'mo salah': 'Egiptus',
  salah: 'Egiptus',
  'santiago gimenez': 'Mehhiko',
  'jonathan david': 'Kanada',
  'alphonso davies': 'Kanada',
  'son heung min': 'Lõuna-Korea',
  'patrik schick': 'Tšehhi',
  'cody gakpo': 'Holland'
};

const unknownScorerValues = new Set(['', '*', 'not selected', 'prediction unavailable', 'tbc', 'tbd', 'unknown', 'unknown team']);

export function resolveScorerTeam(playerName: string | undefined, importedTeam: string | undefined): string {
  const normalizedImportedTeam = normalizeScorerName(importedTeam);
  if (importedTeam && normalizedImportedTeam && !unknownScorerValues.has(normalizedImportedTeam)) return importedTeam;
  const normalized = normalizeScorerName(playerName);
  if (!normalized || unknownScorerValues.has(normalized)) return 'Võistkond teadmata';
  return scorerTeamByNormalizedName[normalized] ?? 'Võistkond teadmata';
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
