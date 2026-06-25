import { describe, expect, it } from 'vitest';
import { derivePublicResultStatus } from '../server/results/publicResultStatus.js';

describe('public result status', () => {
  it('keeps all active in-progress provider states in the live bucket', () => {
    expect(derivePublicResultStatus({ status: 'HT' })).toBe('LIVE');
    expect(derivePublicResultStatus({ provisional_status: 'ET' })).toBe('LIVE');
    expect(derivePublicResultStatus({ raw_provider_status: 'penalties' })).toBe('LIVE');
    expect(derivePublicResultStatus({ raw_provider_status: 'in play' })).toBe('LIVE');
  });

  it('still keeps confirming and scheduled states out of the live bucket', () => {
    expect(derivePublicResultStatus({ public_status: 'CONFIRMING' })).toBe('CONFIRMING');
    expect(derivePublicResultStatus({ status: 'SCHEDULED' })).toBe('SCHEDULED');
  });
});
