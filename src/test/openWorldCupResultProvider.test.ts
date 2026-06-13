import { describe, expect, it, vi } from 'vitest';
import { buildOpenWorldCupFixtureLookup, OpenWorldCupResultProvider, normalizeOpenWorldCupGame } from '../server/results/openWorldCupResultProvider.js';
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

  it('treats finished string flags as final even when the match type is group', async () => {
    const game = sampleGame('group', 2, 0, 'TRUE');
    const provider = providerFor(game);
    const update = await provider.fetchMatchUpdate(match, new Date('2026-06-11T21:30:00.000Z'));

    expect(normalizeOpenWorldCupGame(game)).toMatchObject({ rawStatus: 'FINISHED', homeScore: 2, awayScore: 0 });
    expect(update).toMatchObject({ status: 'FINISHED', isFinal: true, homeScore: 2, awayScore: 0 });
  });

  it('parses explicit home and away scorer names from open-worldcup payloads', async () => {
    const game = sampleGame('group', 2, 1, 'TRUE', 1, {
      home_scorers: '{"J. Quinones 9\'","R. Jimenez 67\'"}',
      away_scorers: '{"L. Krejci 59\'"}'
    });
    const provider = providerFor(game);
    const update = await provider.fetchMatchUpdate(match, new Date('2026-06-11T21:30:00.000Z'));

    expect(update.scorers).toEqual([
      { playerName: 'J. Quinones', teamName: 'Mexico', teamCode: undefined, goals: 1 },
      { playerName: 'R. Jimenez', teamName: 'Mexico', teamCode: undefined, goals: 1 },
      { playerName: 'L. Krejci', teamName: 'South Africa', teamCode: undefined, goals: 1 }
    ]);
  });

  it('does not invent scorers when the provider omits scorer fields', async () => {
    const game = sampleGame('group', 2, 0, 'TRUE');
    const provider = providerFor(game);
    const update = await provider.fetchMatchUpdate(match, new Date('2026-06-11T21:30:00.000Z'));

    expect(update.homeScore).toBe(2);
    expect(update.awayScore).toBe(0);
    expect(update.scorers).toBeUndefined();
  });

  it('fetches mapped fixtures only for high-confidence candidate rows', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toContain('/get/games');
      return {
        ok: true,
        status: 200,
        async text() {
          return '';
        },
        async json() {
          return { response: [sampleGame('finished', 3, 2, true, 42)] };
        }
      };
    });
    const provider = new OpenWorldCupResultProvider(
      { apiBaseUrl: 'https://worldcup26.ir' },
      fetchImpl,
      buildOpenWorldCupFixtureLookup({
        fixtures: [
          { providerFixtureId: '42', matchedInternalMatchId: 1, confidence: 'high' }
        ]
      })
    );

    const update = await provider.fetchMatchUpdate(match, new Date('2026-06-11T21:30:00.000Z'));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(update).toMatchObject({
      providerMatchId: '42',
      status: 'FINISHED',
      isFinal: true,
      homeScore: 3,
      awayScore: 2
    });
  });

  it('treats live provider status as non-final', async () => {
    const provider = new OpenWorldCupResultProvider(
      { apiBaseUrl: 'https://worldcup26.ir' },
      vi.fn(async () => ({
        ok: true,
        status: 200,
        async text() {
          return '';
        },
        async json() {
          return { response: [sampleGame('LIVE', 1, 0, false, 42)] };
        }
      })),
      buildOpenWorldCupFixtureLookup({
        fixtures: [
          { providerFixtureId: '42', matchedInternalMatchId: 1, confidence: 'high' }
        ]
      })
    );

    const update = await provider.fetchMatchUpdate(match, new Date('2026-06-11T19:30:00.000Z'));

    expect(update).toMatchObject({
      status: 'LIVE',
      isFinal: false,
      homeScore: 1,
      awayScore: 0
    });
  });

  it('skips non-high candidate rows without calling the API', async () => {
    const fetchImpl = vi.fn();
    const provider = new OpenWorldCupResultProvider(
      { apiBaseUrl: 'https://worldcup26.ir' },
      fetchImpl,
      buildOpenWorldCupFixtureLookup({
        fixtures: [
          { providerFixtureId: '99', matchedInternalMatchId: 1, confidence: 'low' }
        ]
      })
    );

    const update = await provider.fetchMatchUpdate(match, new Date('2026-06-11T21:30:00.000Z'));

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(update).toMatchObject({
      provider: 'open-worldcup-result-provider',
      isFinal: false,
      warning: 'Open World Cup candidate map has no high-confidence fixture for internal match 1; skipped until manually verified.'
    });
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
      expect(String(url)).toContain('/get/games');
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

function sampleGame(
  status: string,
  homeScore = 0,
  awayScore = 0,
  finished: unknown = false,
  id = 1,
  extras: Record<string, unknown> = {}
) {
  return {
    id,
    status,
    finished,
    local_date: '2026-06-11T19:00:00.000Z',
    updated_at: '2026-06-11T21:00:00.000Z',
    home_score: homeScore,
    away_score: awayScore,
    home_team_label: 'Mexico',
    away_team_label: 'South Africa',
    stadium_name: 'Estadio Azteca',
    goalscorers: [],
    ...extras
  };
}
