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
  { county: 'Haapsalu', initials: 'HA', tone: 'blue', crestUrl: '/counties/haapsalu.svg' },
  { county: 'Harku', initials: 'HK', tone: 'green', crestUrl: '/counties/harku.svg' },
  { county: 'Hiiumaa', initials: 'HI', tone: 'gold', crestUrl: '/counties/hiiumaa.svg' },
  { county: 'Kambja', initials: 'KA', tone: 'red', crestUrl: '/counties/kambja.svg' },
  { county: 'Kanepi', initials: 'KN', tone: 'green', crestUrl: '/counties/kanepi.svg' },
  { county: 'Kastre', initials: 'KS', tone: 'blue', crestUrl: '/counties/kastre.svg' },
  { county: 'Kiili', initials: 'KI', tone: 'gold', crestUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Kiili_coat_of_arms.svg' },
  { county: 'Lääne-Harju', initials: 'LH', tone: 'blue', crestUrl: '/counties/laane-harju.svg' },
  { county: 'Paide', initials: 'PA', tone: 'red', crestUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Paide_vapp.svg' },
  { county: 'Rae', initials: 'RA', tone: 'gold', crestUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d8/Rae_valla_vapp.svg' },
  { county: 'Rakvere', initials: 'RV', tone: 'red', crestUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Rakvere_vapp.svg' },
  { county: 'Rapla', initials: 'RP', tone: 'green', crestUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/68/Raplamaa_vapp.svg' },
  { county: 'Rõuge', initials: 'RÕ', tone: 'blue', crestUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/27/R%C3%B5uge_valla_vapp.svg' },
  { county: 'Saaremaa', initials: 'SA', tone: 'gold', crestUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/54/Saaremaa_vapp.svg' },
  { county: 'Saku', initials: 'SK', tone: 'green', crestUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Saku_valla_vapp.svg' },
  { county: 'Saue', initials: 'SU', tone: 'red', crestUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Saue_valla_vapp.svg' },
  { county: 'Tallinn', initials: 'TL', tone: 'blue', crestUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Tallinn_wapen.svg' },
  { county: 'Tartu', initials: 'TR', tone: 'red', crestUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Tartu_coat_of_arms.svg' },
  { county: 'Tartumaa', initials: 'TM', tone: 'red', crestUrl: '/counties/tartumaa.svg' },
  { county: 'Viimsi', initials: 'VI', tone: 'green', crestUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/37/Viimsi_valla_vapp.svg' }
];

const visualByCounty = new Map(countyVisuals.map((entry) => [normalizeCountyName(entry.county), entry]));

export function resolveCountyVisual(county: string | undefined, catalog: CountyVisualEntry[] = countyVisuals): CountyVisual {
  const normalizedCounty = normalizeCountyName(county);
  const source =
    catalog === countyVisuals
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
