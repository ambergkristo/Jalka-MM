import { describe, expect, it } from 'vitest';
import { statusLabel } from '../client/components/DataStatus.js';

describe('statusLabel', () => {
  it('maps official data statuses to user-facing labels', () => {
    expect(statusLabel('official')).toBe('Official data');
    expect(statusLabel('partial_official')).toBe('Partially official data');
    expect(statusLabel('seeded')).toBe('Seeded data');
  });
});
