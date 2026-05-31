import { describe, expect, it } from 'vitest';
import { visibleFlag } from '../client/components/TeamBadge.js';

describe('visibleFlag', () => {
  it('uses stored emoji flags for concrete teams', () => {
    expect(visibleFlag('🇲🇽')).toBe('🇲🇽');
  });

  it('does not show corrupted flag values', () => {
    expect(visibleFlag('????')).toBe('⚽');
    expect(visibleFlag('')).toBe('⚽');
  });
});
