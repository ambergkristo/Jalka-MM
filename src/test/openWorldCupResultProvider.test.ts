import { describe, expect, it, vi } from 'vitest';
import { OpenWorldCupResultProvider, normalizeOpenWorldCupGame } from '../server/results/openWorldCupResultProvider.js';
import type { TrackedMatch } from '../server/results/resultTypes.js';

const match: TrackedMatch = {
  id: 1,
  kickoffUtc: '2026-06-11T19:00:00.000Z',
  status: 'SCHEDULED',
  homeTeam: 'Mexico',
  awayTeam: 'South Africa',
  isFinal: false
};

describe('Open World Cup result provider', () => {
  it('normalizes scheduled and final sample responses', async () => {
    const scheduled = await providerFor(sampleGame('scheduled')).fetchMatchUpdate(match, new Date('2026-06-11T18:30:00.000Z'));
    expect(normalizeOpenWorldCupGame(sampleGame('scheduled'))).toMatchObject({ rawStatus: 'SCHEDULED', homeScore: 0, awayScore: 0 });
    expect(scheduled).toMatchObject({ status: 'SCHEDULED', isFinal: false, homeScore: 0, awayScore: 0 });

    const final = await providerFor(sampleGame('FT', 2, 1, true)).fetchMatchUpdate(match, new Date('2026-06-11T21:30:00.000Z'));
    expect(normalizeOpenWorldCupGame(sampleGame('FT', 2, 1, true))).toMatchObject({ rawStatus: 'FINISHED', homeScore: 2, awayScore: 1 });
    expect(final).toMatchObject({ status: 'FINISHED', isFinal: true, homeScore: 2, awayScore: 1 });
    expect(String(final.providerUpdatedAt ?? '')).toContain('2026-06-11');
  });

  it('returns a safe warning when the API base URL is missing', async () => {
    const fetchImpl = vi.fn();
    const provider = new OpenWorldCupResultProvider({} as never, fetchImpl);
    const update = await provider.fetchMatchUpdate(match, new Date('2026-06-11T18:30:00.000Z'));

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(update).toMatchObject({
      provider: 'open-worldcup-result-provider',
      isFinal: false,
      warning: 'OPEN_WORLDCUP_API_BASE_URL is required for open-worldcup provider.'
    });
  });
});

function providerFor(game: Record<string, unknown>) {
  return new OpenWorldCupResultProvider(
    { apiBaseUrl: 'https://worldcup26.ir' },
    vi.fn(async (url) => {
      expect(String(url)).toContain('/get/game/1');
      return {
        ok: true,
        status: 200,
        async text() {
          return '';
        },
        async json() {
          return { response: [game] };
        }
      };
    })
  );
}

function sampleGame(status: string, homeScore = 0, awayScore = 0, finished = false) {
  return {
    id: 1,
    status,
    finished,
    local_date: '2026-06-11T19:00:00.000Z',
    updated_at: '2026-06-11T21:00:00.000Z',
    home_score: homeScore,
    away_score: awayScore,
    home_team_label: 'Mexico',
    away_team_label: 'South Africa',
    stadium_name: 'Estadio Azteca',
    goalscorers: []
  };
}
