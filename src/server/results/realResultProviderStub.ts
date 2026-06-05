import type { ResultProvider } from './resultProvider.js';
import type { ResultProviderConfig } from './resultProviderConfig.js';
import type { ResultUpdate, TrackedMatch } from './resultTypes.js';

export class RealResultProviderStub implements ResultProvider {
  readonly mode = 'live' as const;
  readonly name: string;

  constructor(private readonly config: ResultProviderConfig) {
    this.name = `${config.provider}-result-provider`;
  }

  async fetchMatchUpdate(_match: TrackedMatch, _now: Date): Promise<ResultUpdate> {
    throw new Error(
      `Result provider "${this.config.provider}" is configured but this provider adapter has not been implemented.`
    );
  }
}
