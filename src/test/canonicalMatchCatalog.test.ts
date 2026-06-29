import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCanonicalPlayoffState } from '../server/results/playoffState.js';
import { listCanonicalRuntimeMatches, toTrackedMatch } from '../server/results/canonicalMatchCatalog.js';
import type { QueryableDatabase } from '../server/databaseAdapter.js';

describe('canonical match catalog', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the same canonical playoff fixture source for public schedule and tracked match #73', async () => {
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
              type: 'R32',
              status: 'FINISHED',
              local_date: '2026-06-28T19:00:00.000Z',
              home_team_name_en: 'South Africa',
              away_team_name_en: 'Canada',
              home_team_label: 'South Africa',
              away_team_label: 'Canada',
              home_score: 0,
              away_score: 1
            }
          ]
        };
      }
    })));

    const db: QueryableDatabase = {
      provider: 'sqlite',
      async run() {},
      async exec() {},
      async close() {},
      async transaction<T>(callback: (tx: QueryableDatabase) => Promise<T>) {
        return callback(this);
      },
      async one() {
        return null;
      },
      async all(sql: string) {
        if (sql.includes('FROM matches m')) {
          return [{
            id: 73,
            stage: 'R32',
            kickoff_at: 'TBC',
            home_team_id: null,
            away_team_id: null,
            home_team: 'Group A runners-up',
            away_team: 'Group B runners-up',
            home_team_code: null,
            away_team_code: null,
            provider_fixture_id: null,
            status: null,
            public_status: null,
            home_score: null,
            away_score: null,
            minute: null,
            is_final: 0,
            last_checked_at: null,
            next_check_at: null,
            next_confirmation_check_at: null,
            needs_review_reason: null,
            raw_provider_status: null,
            confirmation_confidence: null,
            confirmed_home_score: null,
            confirmed_away_score: null,
            provisional_home_score: null,
            provisional_away_score: null,
            provisional_status: null
          }];
        }
        return [];
      }
    };

    const playoffState = await buildCanonicalPlayoffState({
      confirmedGroupStageMatches: 72,
      now: new Date('2026-06-29T06:05:00.000Z')
    });
    const fixture73 = playoffState.bracketFixturesByMatchId.get(73);
    const runtime73 = (await listCanonicalRuntimeMatches(db, new Date('2026-06-29T06:05:00.000Z')))[0];
    const tracked73 = toTrackedMatch(runtime73);

    expect(fixture73).toMatchObject({
      matchId: 73,
      providerFixtureId: '73',
      kickoffAt: '2026-06-28T19:00:00.000Z',
      homeTeam: 'Lõuna-Aafrika',
      awayTeam: 'Kanada'
    });
    expect(runtime73).toMatchObject({
      id: 73,
      providerFixtureId: fixture73?.providerFixtureId,
      kickoffAt: fixture73?.kickoffAt,
      homeTeam: fixture73?.homeTeam,
      awayTeam: fixture73?.awayTeam
    });
    expect(tracked73).toMatchObject({
      id: 73,
      providerMatchId: '73',
      kickoffUtc: '2026-06-28T19:00:00.000Z',
      homeTeam: 'Lõuna-Aafrika',
      awayTeam: 'Kanada'
    });
  });
});
