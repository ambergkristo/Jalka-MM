import { toResultUpdate, type ResultProvider } from './resultProvider.js';
import { MATCHDAY1_SIMULATION_RESULTS } from './simulationFixtures.js';
import type { ResultUpdate, TrackedMatch } from './resultTypes.js';

export type SimulationProviderScenario = 'matchday1' | 'matchday1-disagreement';

export class SimulationResultProvider implements ResultProvider {
  readonly mode = 'mock' as const;
  readonly name: string;

  constructor(
    private readonly scenario: SimulationProviderScenario = 'matchday1',
    providerName = 'simulation-provider'
  ) {
    this.name = providerName;
  }

  async fetchMatchUpdate(match: TrackedMatch, now: Date): Promise<ResultUpdate> {
    const simulated = MATCHDAY1_SIMULATION_RESULTS.find((result) => result.matchId === match.id);
    if (!simulated) {
      return toResultUpdate({
        match,
        provider: this.name,
        providerStatus: match.status,
        now,
        nextCheckAt: match.nextCheckAt
      });
    }

    const awayScore = this.scenario === 'matchday1-disagreement'
      ? simulated.awayScore + 1
      : simulated.awayScore;

    return toResultUpdate({
      match,
      provider: this.name,
      providerStatus: 'finished',
      now,
      providerMatchId: `simulation-${match.id}`,
      homeScore: simulated.homeScore,
      awayScore,
      minute: simulated.minute,
      nextCheckAt: match.nextCheckAt
    });
  }
}
