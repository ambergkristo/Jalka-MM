import { findNextSuggestedRunAt, planMatchUpdates } from './matchScheduler.js';
import type { ResultAgentRunSummary, ResultAgentStatus, ResultUpdate, ResultsAgentRepository, TrackedMatch } from './resultTypes.js';

export class InMemoryResultRepository implements ResultsAgentRepository {
  private readonly matches = new Map<number, TrackedMatch>();
  private readonly updates = new Map<number, ResultUpdate>();
  private lastRunAt?: string;

  constructor(matches: TrackedMatch[] = createDefaultMockMatches()) {
    for (const match of matches) this.matches.set(match.id, { ...match });
  }

  async listTrackedMatches(): Promise<TrackedMatch[]> {
    return [...this.matches.values()].map((match) => ({ ...match }));
  }

  async saveResultUpdate(update: ResultUpdate): Promise<{ finalResultChanged: boolean }> {
    const previous = this.updates.get(update.matchId);
    const existingMatch = this.matches.get(update.matchId);
    this.updates.set(update.matchId, { ...update });
    if (existingMatch) {
      this.matches.set(update.matchId, {
        ...existingMatch,
        status: update.status,
        homeScore: update.homeScore,
        awayScore: update.awayScore,
        minute: update.minute,
        isFinal: update.isFinal,
        lastCheckedAt: update.lastCheckedAt,
        nextCheckAt: update.nextCheckAt
      });
    }
    const finalResultChanged =
      update.isFinal &&
      (!previous ||
        previous.homeScore !== update.homeScore ||
        previous.awayScore !== update.awayScore ||
        previous.status !== update.status);
    return { finalResultChanged };
  }

  async getFinalizedResults(): Promise<ResultUpdate[]> {
    return [...this.updates.values()].filter((update) => update.isFinal);
  }

  async getStatus(provider: string, now: Date): Promise<ResultAgentStatus> {
    const plans = planMatchUpdates(await this.listTrackedMatches(), now);
    return {
      lastRunAt: this.lastRunAt,
      nextSuggestedRunAt: findNextSuggestedRunAt(plans),
      staleMatchesCount: plans.filter((plan) => plan.shouldCheckNow).length,
      provider,
      mode: 'mock',
      lastLeaderboardRebuildAt: undefined
    };
  }

  async markPointsRecalculated(matchId: number, timestamp: string): Promise<void> {
    const update = this.updates.get(matchId);
    if (update) this.updates.set(matchId, { ...update, pointsRecalculatedAt: timestamp });
  }

  async saveRunSummary(summary: ResultAgentRunSummary): Promise<void> {
    this.lastRunAt = summary.finishedAt;
  }
}

export function createDefaultMockMatches(now = new Date('2026-06-15T18:00:00.000Z')): TrackedMatch[] {
  const kickoff = (minutesFromNow: number) => new Date(now.getTime() + minutesFromNow * 60_000).toISOString();
  return [
    { id: 1, kickoffUtc: kickoff(60), status: 'SCHEDULED', homeTeam: 'Mexico', awayTeam: 'Japan', isFinal: false },
    { id: 2, kickoffUtc: kickoff(-35), status: 'LIVE', homeTeam: 'Canada', awayTeam: 'Morocco', isFinal: false },
    { id: 3, kickoffUtc: kickoff(-55), status: 'HT', homeTeam: 'Brazil', awayTeam: 'Croatia', isFinal: false },
    { id: 4, kickoffUtc: kickoff(-125), status: 'LIVE', homeTeam: 'Argentina', awayTeam: 'Korea Republic', isFinal: false },
    { id: 5, kickoffUtc: kickoff(-110), status: 'ET', homeTeam: 'France', awayTeam: 'Denmark', isFinal: false },
    { id: 6, kickoffUtc: kickoff(-125), status: 'PEN', homeTeam: 'Spain', awayTeam: 'Senegal', isFinal: false },
    { id: 7, kickoffUtc: kickoff(240), status: 'POSTPONED', homeTeam: 'England', awayTeam: 'Serbia', isFinal: false },
    { id: 8, kickoffUtc: kickoff(-25), status: 'SUSPENDED', homeTeam: 'Portugal', awayTeam: 'Uruguay', isFinal: false }
  ];
}
