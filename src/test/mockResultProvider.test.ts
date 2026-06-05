import { describe, expect, it } from 'vitest';
import { MockResultProvider } from '../server/results/mockResultProvider.js';
import { normalizeProviderStatus } from '../server/results/resultProvider.js';

describe('mock result provider', () => {
  it('normalizes provider statuses into internal match statuses', () => {
    expect(normalizeProviderStatus('half-time')).toBe('HT');
    expect(normalizeProviderStatus('extra time')).toBe('ET');
    expect(normalizeProviderStatus('penalty-shootout')).toBe('PEN');
    expect(normalizeProviderStatus('full time')).toBe('FINISHED');
    expect(normalizeProviderStatus('interrupted')).toBe('SUSPENDED');
  });

  it('returns deterministic updates for known mock matches', async () => {
    const provider = new MockResultProvider();
    const update = await provider.fetchMatchUpdate(
      {
        id: 4,
        kickoffUtc: '2026-06-15T16:00:00.000Z',
        status: 'LIVE',
        homeTeam: 'Argentina',
        awayTeam: 'Korea Republic',
        isFinal: false
      },
      new Date('2026-06-15T18:00:00.000Z')
    );
    expect(update).toMatchObject({
      matchId: 4,
      status: 'FINISHED',
      homeScore: 2,
      awayScore: 1,
      isFinal: true,
      provider: 'mock-result-provider'
    });
  });
});
