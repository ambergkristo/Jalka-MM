import type { ResultProvider } from './resultProvider.js';
import { toResultUpdate } from './resultProvider.js';
import type { ResultUpdate, TrackedMatch } from './resultTypes.js';

interface MockScenario {
  providerStatus: string;
  homeScore?: number;
  awayScore?: number;
  minute?: number;
}

const scenarios: Record<number, MockScenario> = {
  1: { providerStatus: 'scheduled' },
  2: { providerStatus: 'live', homeScore: 1, awayScore: 0, minute: 34 },
  3: { providerStatus: 'half-time', homeScore: 1, awayScore: 1, minute: 45 },
  4: { providerStatus: 'finished', homeScore: 2, awayScore: 1, minute: 90 },
  5: { providerStatus: 'extra-time', homeScore: 2, awayScore: 2, minute: 103 },
  6: { providerStatus: 'penalties', homeScore: 2, awayScore: 2, minute: 120 },
  7: { providerStatus: 'postponed' },
  8: { providerStatus: 'suspended', homeScore: 0, awayScore: 0, minute: 22 }
};

export class MockResultProvider implements ResultProvider {
  name = 'mock-result-provider';

  async fetchMatchUpdate(match: TrackedMatch, now: Date): Promise<ResultUpdate> {
    const scenario = scenarios[match.id] ?? inferScenario(match, now);
    return toResultUpdate({
      match,
      provider: this.name,
      providerStatus: scenario.providerStatus,
      now,
      homeScore: scenario.homeScore,
      awayScore: scenario.awayScore,
      minute: scenario.minute,
      nextCheckAt: match.nextCheckAt
    });
  }
}

function inferScenario(match: TrackedMatch, now: Date): MockScenario {
  const kickoff = Date.parse(match.kickoffUtc);
  const elapsedMinutes = Math.floor((now.getTime() - kickoff) / 60_000);
  if (elapsedMinutes < -30) return { providerStatus: 'scheduled' };
  if (elapsedMinutes < 45) return { providerStatus: 'live', homeScore: 0, awayScore: 0, minute: Math.max(0, elapsedMinutes) };
  if (elapsedMinutes < 60) return { providerStatus: 'half-time', homeScore: 1, awayScore: 0, minute: 45 };
  if (elapsedMinutes < 110) return { providerStatus: 'live', homeScore: 1, awayScore: 1, minute: Math.min(90, elapsedMinutes - 15) };
  return { providerStatus: 'finished', homeScore: 1, awayScore: 1, minute: 90 };
}
