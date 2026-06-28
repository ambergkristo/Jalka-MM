import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCanonicalPlayoffState } from '../server/results/playoffState.js';
import { formatTallinnKickoff } from '../client/data/publicDashboard.js';

describe('playoff state', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not promote a scheduled provider fixture to live just because kickoff has passed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      async text() {
        return '';
      },
      async json() {
        return {
          response: [
            {
              id: 73,
              type: 'r32',
              status: 'SCHEDULED',
              local_date: '2026-06-28T12:00:00.000Z',
              home_team_name_en: 'South Africa',
              away_team_name_en: 'Canada',
              home_team_label: 'South Africa',
              away_team_label: 'Canada',
              home_score: 0,
              away_score: 0
            }
          ]
        };
      }
    })));

    const state = await buildCanonicalPlayoffState({
      confirmedGroupStageMatches: 72,
      now: new Date('2026-06-28T15:30:00.000Z')
    });
    const fixture = state.bracketFixturesByMatchId.get(73);

    expect(fixture?.status).toBe('scheduled');
    expect(state.fixtures.filter((item) => item.status === 'live')).toHaveLength(0);
    expect(state.upcomingPlayoffFixturesCount).toBeGreaterThan(0);
  });

  it('marks explicit LIVE provider status as live', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      async text() {
        return '';
      },
      async json() {
        return {
          response: [
            {
              id: 73,
              type: 'r32',
              status: 'LIVE',
              local_date: '2026-06-28T12:00:00.000Z',
              home_team_name_en: 'South Africa',
              away_team_name_en: 'Canada',
              home_team_label: 'South Africa',
              away_team_label: 'Canada',
              home_score: 1,
              away_score: 0
            }
          ]
        };
      }
    })));

    const state = await buildCanonicalPlayoffState({
      confirmedGroupStageMatches: 72,
      now: new Date('2026-06-28T11:30:00.000Z')
    });

    expect(state.bracketFixturesByMatchId.get(73)?.status).toBe('live');
  });

  it('formats playoff kickoff timestamps in Europe/Tallinn', () => {
    expect(formatTallinnKickoff('2026-06-28T12:00:00.000Z')).toBe('28.06 15:00');
  });
});
