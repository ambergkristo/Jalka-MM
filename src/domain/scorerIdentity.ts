export interface ScorerIdentityInput {
  playerName?: string;
  playerId?: string;
  providerPlayerId?: string;
}

export interface ResolvedScorerIdentity {
  playerName: string;
  playerId?: string;
  providerPlayerId?: string;
  lookupKey: string;
}

interface KnownScorer {
  id: string;
  displayName: string;
  aliases: string[];
}

const knownScorers: KnownScorer[] = [
  {
    id: 'lionel-messi',
    displayName: 'Lionel Messi',
    aliases: ['Lionel Messi', 'Messi', 'Livnl Msi']
  },
  {
    id: 'kylian-mbappe',
    displayName: 'Kylian Mbapp\u00e9',
    aliases: ['Kylian Mbapp\u00e9', 'Kylian Mbappe', 'K. Mbapp\u00e9', 'K. Mbappe', 'K Mbappe', 'Mbapp\u00e9', 'Mbappe', 'Kylian Mpabbe', 'Kylian Mbappe\u00b4']
  },
  {
    id: 'mohamed-salah',
    displayName: 'Mohamed Salah',
    aliases: ['Mohamed Salah', 'Mohammed Salah', 'Mo Salah', 'M. Salah', 'Salah']
  },
  {
    id: 'erling-haaland',
    displayName: 'Erling Haaland',
    aliases: ['Erling Haaland', 'Erling Haland', 'Haaland', 'Arling Halnd']
  },
  {
    id: 'elijah-just',
    displayName: 'Elijah Just',
    aliases: ['Elijah Just', 'Ali Jast']
  },
  {
    id: 'aymen-hussein',
    displayName: 'Aymen Hussein',
    aliases: ['Aymen Hussein', 'Aimn Hsin']
  },
  {
    id: 'abdulelah-al-amri',
    displayName: 'Abdulelah Al-Amri',
    aliases: ['Abdulelah Al-Amri', 'Abdallh Alamri']
  },
  {
    id: 'breel-embolo',
    displayName: 'Breel Embolo',
    aliases: ['Breel Embolo']
  },
  {
    id: 'viktor-gyokeres',
    displayName: 'Viktor Gy\u00f6keres',
    aliases: ['Viktor Gy\u00f6keres', 'V. Gy\u00f6keres', 'V Gyokeres']
  },
  {
    id: 'maximiliano-araujo',
    displayName: 'Maximiliano Ara\u00fajo',
    aliases: ['Maximiliano Ara\u00fajo']
  },
  {
    id: 'leo-ostigard',
    displayName: 'Leo \u00d8stig\u00e5rd',
    aliases: ['Leo \u00d8stig\u00e5rd', 'Leo Ostigard']
  },
  {
    id: 'mauricio',
    displayName: 'Maur\u00edcio',
    aliases: ['Maur\u00edcio', 'Mauricio']
  }
];

const aliasByLookupKey = buildAliasMap();

export function normalizeScorerName(value: string): string {
  const cleaned = stripScorerEventText(repairMojibake(value));
  const known = aliasByLookupKey.get(scorerLookupKey(cleaned));
  return known?.displayName ?? cleaned;
}

export function resolveScorerIdentity(input: ScorerIdentityInput): ResolvedScorerIdentity {
  const cleanedName = normalizeScorerDisplayName(input.playerName ?? '');
  const known = aliasByLookupKey.get(scorerLookupKey(cleanedName));
  const playerId = cleanId(input.playerId) ?? known?.id;
  const playerName = known?.displayName ?? cleanedName;
  return {
    playerName,
    playerId,
    providerPlayerId: cleanId(input.providerPlayerId),
    lookupKey: playerId ?? scorerLookupKey(playerName)
  };
}

export function scorerIdentityGroupKey(input: ScorerIdentityInput & { teamId?: string | null; teamCode?: string | null }): string {
  const identity = resolveScorerIdentity(input);
  if (identity.providerPlayerId) return `provider:${identity.providerPlayerId}`;
  if (identity.playerId) return `player:${identity.playerId}`;
  return `name:${identity.lookupKey}|team:${input.teamId ?? input.teamCode ?? ''}`;
}

export function scorerLookupKey(value: string | undefined): string {
  return normalizeScorerDisplayName(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function normalizeScorerDisplayName(value: string): string {
  return stripScorerEventText(repairMojibake(value));
}

function stripScorerEventText(value: string): string {
  let text = value
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, ' ')
    .trim();

  if (!text) return '';

  let previous: string | undefined;
  do {
    previous = text;
    text = text
      .replace(/\s*(?:assist(?:ed)?(?: by)?|assists?:).+$/iu, '')
      .replace(/\s*[\[(]\s*(?:OG|O\.G\.|own goal|p|pen\.?|penalty)\s*[\])]\s*$/iu, '')
      .replace(/\s*\b(?:OG|O\.G\.|own goal|pen\.?|penalty)\b\.?\s*$/iu, '')
      .replace(/\s*\(?\d{1,3}\s*['`]*(?:\s*\+\s*\d{1,3})?\)?\s*['`]*\s*$/u, '')
      .replace(/\s*[\[(]\s*$/u, '')
      .replace(/\s*[-:]\s*$/u, '')
      .trim();
  } while (text !== previous);

  return text.replace(/\s+/g, ' ').trim();
}

function repairMojibake(value: string): string {
  return value
    .replace(/Ã©/g, '\u00e9')
    .replace(/Ã¡/g, '\u00e1')
    .replace(/Ã­/g, '\u00ed')
    .replace(/Ã³/g, '\u00f3')
    .replace(/Ã¶/g, '\u00f6')
    .replace(/Ã¸/g, '\u00f8')
    .replace(/Ã¥/g, '\u00e5')
    .replace(/Ã§/g, '\u00e7')
    .replace(/Ã¼/g, '\u00fc')
    .replace(/â/g, '\u2019');
}

function cleanId(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned || undefined;
}

function buildAliasMap(): Map<string, KnownScorer> {
  const map = new Map<string, KnownScorer>();
  for (const scorer of knownScorers) {
    for (const alias of [scorer.displayName, ...scorer.aliases]) {
      map.set(scorerLookupKey(alias), scorer);
    }
  }
  return map;
}
