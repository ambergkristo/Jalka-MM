import { ProviderChainResultProvider } from './providerChainResultProvider.js';
import type { ResultProvider, ResultProviderChain } from './resultProvider.js';
import type { ResultUpdate, TrackedMatch } from './resultTypes.js';

export interface FreeWorldCupProviderPlan {
  providerNames: string[];
  footballDataVerifier: 'enabled' | 'disabled';
  staticFixtureFallback: 'bundled-worldcup2026-schedule';
  scorerProvider: 'open-worldcup-or-manual';
}

export class FreeWorldCupResultProvider implements ResultProvider, ResultProviderChain {
  readonly name: string;
  readonly mode: 'mock' | 'live';
  private readonly chain: ProviderChainResultProvider;

  constructor(
    readonly providers: ResultProvider[],
    readonly plan: FreeWorldCupProviderPlan
  ) {
    this.chain = new ProviderChainResultProvider(providers);
    this.name = `free-worldcup-provider-chain:${providers.map((provider) => provider.name).join(',')}`;
    this.mode = this.chain.mode;
  }

  fetchMatchUpdate(match: TrackedMatch, now: Date): Promise<ResultUpdate> {
    return this.chain.fetchMatchUpdate(match, now);
  }

  fetchMatchUpdates(match: TrackedMatch, now: Date): Promise<ResultUpdate[]> {
    return this.chain.fetchMatchUpdates(match, now);
  }
}
