import { describe, expect, it } from 'vitest';
import { visibleFlag } from '../client/components/TeamBadge.js';
import { flagIconUrl } from '../client/lib/flagAssets.js';

describe('TeamBadge flag rendering helpers', () => {
  it('resolves concrete teams to local SVG flag assets', () => {
    expect(flagIconUrl('MEX')).toContain('mx.svg');
    expect(flagIconUrl('RSA')).toContain('za.svg');
    expect(flagIconUrl('KOR')).toContain('kr.svg');
    expect(flagIconUrl('CZE')).toContain('cz.svg');
  });

  it('uses neutral rendering for corrupted or missing fallback flag values', () => {
    expect(visibleFlag('????')).toBe('\u26bd');
    expect(visibleFlag('')).toBe('\u26bd');
    expect(flagIconUrl('TBC')).toBeNull();
  });
});
