import { describe, expect, it } from 'vitest';
import { statusLabel } from '../client/components/DataStatus.js';

describe('statusLabel', () => {
  it('maps official data statuses to user-facing labels', () => {
    expect(statusLabel('official')).toBe('Ametlikud andmed');
    expect(statusLabel('partial_official')).toBe('Osaliselt kinnitatud turniiriandmed');
    expect(statusLabel('seeded')).toBe('Näidisandmed');
  });
});
