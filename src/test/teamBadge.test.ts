import { describe, expect, it } from 'vitest';
import { visibleFlag } from '../client/components/TeamBadge.js';
import { flagIconUrl } from '../client/lib/flagAssets.js';
import { teamFromName } from '../client/lib/teamLookup.js';

describe('TeamBadge flag rendering helpers', () => {
  it('resolves concrete teams to local SVG flag assets', () => {
    expect(flagIconUrl('MEX')).toContain('mx.svg');
    expect(flagIconUrl('RSA')).toContain('za.svg');
    expect(flagIconUrl('KOR')).toContain('kr.svg');
    expect(flagIconUrl('CZE')).toContain('cz.svg');
    expect(flagIconUrl('BIH')).toContain('ba.svg');
    expect(flagIconUrl('HAI')).toContain('ht.svg');
    expect(flagIconUrl('TUR')).toContain('tr.svg');
    expect(flagIconUrl('CIV')).toContain('ci.svg');
    expect(flagIconUrl('CPV')).toContain('cv.svg');
    expect(flagIconUrl('UZB')).toContain('uz.svg');
  });

  it('resolves current tournament team names and aliases to flag-ready codes', () => {
    expect(teamFromName('Bosnia and Herzegovina')).toMatchObject({ name: 'Bosnia ja Hertsegoviina', code: 'BIH' });
    expect(teamFromName('Haiti')).toMatchObject({ name: 'Haiti', code: 'HAI' });
    expect(teamFromName('Turkey')).toMatchObject({ name: 'Türgi', code: 'TUR' });
    expect(teamFromName('Côte d’Ivoire')).toMatchObject({ name: 'Elevandiluurannik', code: 'CIV' });
    expect(teamFromName('Cabo Verde')).toMatchObject({ name: 'Cabo Verde', code: 'CPV' });
    expect(teamFromName('United Arab Emirates')).toMatchObject({ name: 'AÜE', code: 'UAE' });
  });

  it('uses neutral rendering for corrupted or missing fallback flag values', () => {
    expect(visibleFlag('????')).toBe('\u26bd');
    expect(visibleFlag('')).toBe('\u26bd');
    expect(flagIconUrl('TBC')).toBeNull();
  });
});
