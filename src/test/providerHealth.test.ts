import { describe, expect, it } from 'vitest';
import { classifyProviderHealth } from '../server/results/providerHealth.js';

describe('provider health classification', () => {
  it('classifies healthy state when there are no delayed matches or failures', () => {
    expect(classifyProviderHealth({
      delayedConfirmationWarnings: [],
      scorerMismatchGoalsCount: 0
    })).toBe('ProviderHealthy');
  });

  it('classifies delayed state when one match is over the confirmation threshold', () => {
    expect(classifyProviderHealth({
      delayedConfirmationWarnings: [{ severity: 'delayed' }],
      scorerMismatchGoalsCount: 0
    })).toBe('ProviderDelayed');
  });

  it('classifies degraded state for repeated delays or a large scorer mismatch', () => {
    expect(classifyProviderHealth({
      delayedConfirmationWarnings: [{ severity: 'delayed' }, { severity: 'delayed' }, { severity: 'delayed' }],
      scorerMismatchGoalsCount: 0
    })).toBe('ProviderDegraded');

    expect(classifyProviderHealth({
      delayedConfirmationWarnings: [],
      scorerMismatchGoalsCount: 6
    })).toBe('ProviderDegraded');
  });

  it('classifies critical state for polling failure or matches older than 180 minutes', () => {
    expect(classifyProviderHealth({
      delayedConfirmationWarnings: [{ severity: 'critical' }],
      scorerMismatchGoalsCount: 0
    })).toBe('ProviderCritical');

    expect(classifyProviderHealth({
      delayedConfirmationWarnings: [],
      scorerMismatchGoalsCount: 0,
      activePollingFailure: true
    })).toBe('ProviderCritical');
  });
});
