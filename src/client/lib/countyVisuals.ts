import { normalizeCountyName } from '../../domain/countyLeaderboard.js';

export interface CountyVisual {
  county: string;
  initials: string;
  tone: string;
  crestUrl?: string;
  isFallback: boolean;
}

interface CountyVisualEntry {
  county: string;
  initials: string;
  tone: string;
  crestUrl?: string;
}

const countyVisuals: CountyVisualEntry[] = [
  { county: 'Haapsalu', initials: 'HA', tone: 'blue' },
  { county: 'Harku', initials: 'HK', tone: 'green' },
  { county: 'Hiiumaa', initials: 'HI', tone: 'gold' },
  { county: 'Kambja', initials: 'KA', tone: 'red' },
  { county: 'Kanepi', initials: 'KN', tone: 'green' },
  { county: 'Kastre', initials: 'KS', tone: 'blue' },
  { county: 'Kiili', initials: 'KI', tone: 'gold' },
  { county: 'Lääne-Harju', initials: 'LH', tone: 'blue' },
  { county: 'Paide', initials: 'PA', tone: 'red' },
  { county: 'Pärnumaa', initials: 'PÄ', tone: 'blue' },
  { county: 'Rae', initials: 'RA', tone: 'gold' },
  { county: 'Rakvere', initials: 'RV', tone: 'red' },
  { county: 'Rapla', initials: 'RP', tone: 'green' },
  { county: 'Rõuge', initials: 'RÕ', tone: 'blue' },
  { county: 'Saaremaa', initials: 'SA', tone: 'gold' },
  { county: 'Saku', initials: 'SK', tone: 'green' },
  { county: 'Saue', initials: 'SU', tone: 'red' },
  { county: 'Tallinn', initials: 'TL', tone: 'blue' },
  { county: 'Tartu', initials: 'TR', tone: 'red' },
  { county: 'Tartumaa', initials: 'TM', tone: 'red' },
  { county: 'Viimsi', initials: 'VI', tone: 'green' }
];

const visualByCounty = new Map(countyVisuals.map((entry) => [normalizeCountyName(entry.county), entry]));

export function resolveCountyVisual(county: string | undefined, catalog: CountyVisualEntry[] = countyVisuals): CountyVisual {
  const normalizedCounty = normalizeCountyName(county);
  const source = catalog === countyVisuals
    ? visualByCounty.get(normalizedCounty)
    : new Map(catalog.map((entry) => [normalizeCountyName(entry.county), entry])).get(normalizedCounty);
  if (source) {
    return {
      county: source.county,
      initials: source.initials,
      tone: source.tone,
      crestUrl: source.crestUrl,
      isFallback: !source.crestUrl
    };
  }

  return {
    county: normalizedCounty,
    initials: initialsForCounty(normalizedCounty),
    tone: 'neutral',
    isFallback: true
  };
}

function initialsForCounty(county: string): string {
  const words = county
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase('et');
  return words.slice(0, 2).map((word) => word.charAt(0).toLocaleUpperCase('et')).join('');
}
