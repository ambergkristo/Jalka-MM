import { describe, expect, it } from 'vitest';
import { flagIconCode } from '../client/lib/flagCodes.js';

describe('flagIconCode', () => {
  it('maps World Cup team codes to local flag-icons SVG codes', () => {
    expect(flagIconCode('MEX')).toBe('mx');
    expect(flagIconCode('RSA')).toBe('za');
    expect(flagIconCode('KOR')).toBe('kr');
    expect(flagIconCode('CZE')).toBe('cz');
  });

  it('uses neutral rendering for unknown or placeholder teams', () => {
    expect(flagIconCode(undefined)).toBeNull();
    expect(flagIconCode('TBC')).toBeNull();
  });
});
