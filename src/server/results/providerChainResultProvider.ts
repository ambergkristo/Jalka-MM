import type { ResultProvider, ResultProviderChain } from './resultProvider.js';
import type { ResultUpdate, TrackedMatch } from './resultTypes.js';

export class ProviderChainResultProvider implements ResultProvider, ResultProviderChain {
  readonly name: string;
  readonly mode: 'mock' | 'live';

  constructor(readonly providers: ResultProvider[]) {
    if (providers.length === 0) throw new Error('Provider chain must include at least one provider.');
    this.name = providers.length === 1 ? providers[0].name : `provider-chain:${providers.map((provider) => provider.name).join(',')}`;
    this.mode = providers.some((provider) => provider.mode === 'live') ? 'live' : 'mock';
  }

  async fetchMatchUpdate(match: TrackedMatch, now: Date): Promise<ResultUpdate> {
    return (await this.fetchMatchUpdates(match, now))[0] ?? providerFailureUpdate(match, now, this.name, 'Provider chain did not return any observations.');
  }

  async fetchMatchUpdates(match: TrackedMatch, now: Date): Promise<ResultUpdate[]> {
    const [primary, ...verifiers] = this.providers;
    const updates: ResultUpdate[] = [];
    const primaryUpdate = await this.fetchSafely(primary, match, now);
    updates.push(primaryUpdate);

    if (!shouldAskVerifier(primaryUpdate, match)) return updates;

    for (const verifier of verifiers) {
      updates.push(await this.fetchSafely(verifier, match, now));
    }
    return updates;
  }

  private async fetchSafely(provider: ResultProvider, match: TrackedMatch, now: Date): Promise<ResultUpdate> {
    try {
      return await provider.fetchMatchUpdate(match, now);
    } catch (error) {
      return providerFailureUpdate(match, now, provider.name, error instanceof Error ? error.message : String(error));
    }
  }
}

export function isResultProviderChain(provider: ResultProvider): provider is ResultProvider & ResultProviderChain {
  return typeof (provider as Partial<ResultProviderChain>).fetchMatchUpdates === 'function';
}

function shouldAskVerifier(primaryUpdate: ResultUpdate, match: TrackedMatch): boolean {
  if (primaryUpdate.isFinal) return true;
  if (primaryUpdate.publicStatus === 'CONFIRMING' || primaryUpdate.publicStatus === 'NEEDS_REVIEW') return true;
  if (match.status === 'FINISHED' && !match.isFinal) return true;
  return false;
}

function providerFailureUpdate(match: TrackedMatch, now: Date, provider: string, message: string): ResultUpdate {
  return {
    matchId: match.id,
    providerMatchId: match.providerMatchId,
    status: match.status,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    minute: match.minute,
    isFinal: false,
    lastCheckedAt: now.toISOString(),
    nextCheckAt: match.nextCheckAt,
    provider,
    warning: `${provider} failed for internal match ${match.id}: ${message}`
  };
}
