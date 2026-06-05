import { describe, expect, it } from 'vitest';
import { ProviderChainResultProvider } from '../server/results/providerChainResultProvider.js';
import type { ResultProvider } from '../server/results/resultProvider.js';
import { toResultUpdate } from '../server/results/resultProvider.js';
import type { ResultUpdate, TrackedMatch } from '../server/results/resultTypes.js';

const match: TrackedMatch = {
  id: 1,
  kickoffUtc: '2026-06-11T19:00:00.000Z',
  status: 'LIVE',
  homeTeam: 'Mexico',
  awayTeam: 'Canada',
  isFinal: false
};

describe('provider chain result provider', () => {
  it('collects observations from multiple providers when primary returns final', async () => {
    const chain = new ProviderChainResultProvider([
      provider('api-football-result-provider', 'finished', 2, 1),
      provider('football-data-result-provider', 'finished', 2, 1)
    ]);

    const updates = await chain.fetchMatchUpdates(match, new Date('2026-06-11T21:00:00.000Z'));

    expect(updates).toHaveLength(2);
    expect(updates.map((update) => update.provider)).toEqual(['api-football-result-provider', 'football-data-result-provider']);
    expect(updates.every((update) => update.isFinal)).toBe(true);
  });

  it('does not call verifier providers for ordinary live primary updates', async () => {
    let verifierCalls = 0;
    const chain = new ProviderChainResultProvider([
      provider('api-football-result-provider', 'live', 1, 0),
      {
        name: 'football-data-result-provider',
        mode: 'live',
        async fetchMatchUpdate(): Promise<ResultUpdate> {
          verifierCalls += 1;
          throw new Error('should not be called');
        }
      }
    ]);

    const updates = await chain.fetchMatchUpdates(match, new Date('2026-06-11T20:00:00.000Z'));

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ status: 'LIVE', isFinal: false });
    expect(verifierCalls).toBe(0);
  });

  it('continues when a verifier provider fails', async () => {
    const chain = new ProviderChainResultProvider([
      provider('api-football-result-provider', 'finished', 2, 1),
      {
        name: 'football-data-result-provider',
        mode: 'live',
        async fetchMatchUpdate(): Promise<ResultUpdate> {
          throw new Error('quota exceeded');
        }
      }
    ]);

    const updates = await chain.fetchMatchUpdates(match, new Date('2026-06-11T21:00:00.000Z'));

    expect(updates).toHaveLength(2);
    expect(updates[1]).toMatchObject({
      provider: 'football-data-result-provider',
      isFinal: false,
      warning: 'football-data-result-provider failed for internal match 1: quota exceeded'
    });
  });
});

function provider(name: string, providerStatus: string, homeScore?: number, awayScore?: number): ResultProvider {
  return {
    name,
    mode: 'live',
    async fetchMatchUpdate(matchInput, now) {
      return toResultUpdate({
        match: matchInput,
        provider: name,
        providerStatus,
        now,
        homeScore,
        awayScore
      });
    }
  };
}
