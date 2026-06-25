import { describe, expect, it } from 'vitest';
import { buildActualGroupStandings } from '../server/results/scoringState.js';
import { deleteThirdPlaceQualifierLockForGroup, listThirdPlaceQualifierLocks, loadOrganizerThirdPlaceQualifierSignals, upsertThirdPlaceQualifierLock } from '../server/results/thirdPlaceQualifierLocks.js';
import { calculateGroupBonusPoints, rebuildLeaderboard } from '../domain/pointsEngine.js';
import type { QueryableDatabase } from '../server/databaseAdapter.js';
import type { GroupPrediction } from '../domain/predictionRepository.js';

describe('third-place qualifier organizer locks', () => {
  it('loads multiple organizer locks from persistent storage and exposes organizerLock signals', async () => {
    const db = createTestDb();
    await seedFinalGroup(db, 'B', [
      ['B1', 'B2', 1, 0],
      ['B1', 'B3', 1, 0],
      ['B1', 'B4', 1, 0],
      ['B2', 'B3', 1, 0],
      ['B2', 'B4', 1, 0],
      ['B3', 'B4', 1, 0]
    ]);
    await seedFinalGroup(db, 'C', [
      ['C1', 'C2', 1, 0],
      ['C1', 'C3', 1, 0],
      ['C1', 'C4', 1, 0],
      ['C2', 'C3', 1, 0],
      ['C2', 'C4', 1, 0],
      ['C3', 'C4', 1, 0]
    ]);

    await upsertThirdPlaceQualifierLock(db, { group: 'B', teamId: 'B3', note: 'Organizer confirmed' }, new Date('2026-06-25T20:00:00.000Z'));
    await upsertThirdPlaceQualifierLock(db, { group: 'C', teamId: 'C3' }, new Date('2026-06-25T20:05:00.000Z'));

    expect(await listThirdPlaceQualifierLocks(db)).toEqual([
      expect.objectContaining({ group: 'B', teamId: 'B3', team: 'Bosnia ja Hertsegoviina', source: 'organizerLock', note: 'Organizer confirmed' }),
      expect.objectContaining({ group: 'C', teamId: 'C3', team: 'Ecuador', source: 'organizerLock' })
    ]);
    expect(await loadOrganizerThirdPlaceQualifierSignals(db)).toEqual([
      { teamName: 'Bosnia ja Hertsegoviina', source: 'organizerLock' },
      { teamName: 'Ecuador', source: 'organizerLock' }
    ]);
  });

  it('does not award Bosnia a third-place qualifier bonus without organizer or provider confirmation', async () => {
    const db = createTestDb();
    await seedFinalGroup(db, 'B', [
      ['B1', 'B2', 1, 0],
      ['B1', 'B3', 1, 0],
      ['B1', 'B4', 1, 0],
      ['B2', 'B3', 1, 0],
      ['B2', 'B4', 1, 0],
      ['B3', 'B4', 1, 0]
    ]);

    const standings = await buildActualGroupStandings(db, {
      confirmedThirdPlaceQualifierSignals: await loadOrganizerThirdPlaceQualifierSignals(db)
    });
    const result = calculateGroupBonusPoints([
      { playerId: 'p1', group: 'B', first: 'Šveits', second: 'Kanada', third: 'Bosnia ja Hertsegoviina' } satisfies GroupPrediction
    ], standings.filter((standing) => standing.group === 'B'));

    expect(result.breakdown).toEqual([{
      group: 'B',
      winnerPoints: 10,
      secondPlacePoints: 5,
      qualifierPoints: 0,
      points: 15
    }]);
  });

  it('awards Bosnia +3 through organizerLock without duplicating qualifier points for correctly placed first and second', async () => {
    const db = createTestDb();
    await seedFinalGroup(db, 'B', [
      ['B1', 'B2', 1, 0],
      ['B1', 'B3', 1, 0],
      ['B1', 'B4', 1, 0],
      ['B2', 'B3', 1, 0],
      ['B2', 'B4', 1, 0],
      ['B3', 'B4', 1, 0]
    ]);
    await upsertThirdPlaceQualifierLock(db, { group: 'B', teamId: 'B3' }, new Date('2026-06-25T20:00:00.000Z'));

    const standings = await buildActualGroupStandings(db, {
      confirmedThirdPlaceQualifierSignals: await loadOrganizerThirdPlaceQualifierSignals(db)
    });
    const result = calculateGroupBonusPoints([
      { playerId: 'p1', group: 'B', first: 'Šveits', second: 'Kanada', third: 'Bosnia ja Hertsegoviina' } satisfies GroupPrediction
    ], standings.filter((standing) => standing.group === 'B'));

    expect(standings.find((standing) => standing.group === 'B' && standing.rank === 3)).toMatchObject({
      team: 'Bosnia ja Hertsegoviina',
      qualified: true,
      qualifierSource: 'organizerLock'
    });
    expect(result.breakdown).toEqual([{
      group: 'B',
      winnerPoints: 10,
      secondPlacePoints: 5,
      qualifierPoints: 3,
      points: 18
    }]);
  });

  it('preserves organizer locks across repeated rebuilds and recalculates leaderboard totals', async () => {
    const db = createTestDb();
    await seedFinalGroup(db, 'B', [
      ['B1', 'B2', 1, 0],
      ['B1', 'B3', 1, 0],
      ['B1', 'B4', 1, 0],
      ['B2', 'B3', 1, 0],
      ['B2', 'B4', 1, 0],
      ['B3', 'B4', 1, 0]
    ]);

    const players = [{ id: 'p1', name: 'Player One' }];
    const groupPredictions: GroupPrediction[] = [
      { playerId: 'p1', group: 'B', first: 'Šveits', second: 'Kanada', third: 'Bosnia ja Hertsegoviina' }
    ];

    const beforeLock = rebuildLeaderboard({
      players,
      predictions: [],
      results: [],
      groupPredictions,
      actualGroupStandings: await buildActualGroupStandings(db, {
        confirmedThirdPlaceQualifierSignals: await loadOrganizerThirdPlaceQualifierSignals(db)
      }),
      recalculatedAt: '2026-06-25T20:00:00.000Z'
    });
    expect(beforeLock.entries[0]?.groupBonusPoints).toBe(15);

    await upsertThirdPlaceQualifierLock(db, { group: 'B', teamId: 'B3', note: 'Locked by organizer' }, new Date('2026-06-25T20:01:00.000Z'));

    const firstRebuild = rebuildLeaderboard({
      players,
      predictions: [],
      results: [],
      groupPredictions,
      actualGroupStandings: await buildActualGroupStandings(db, {
        confirmedThirdPlaceQualifierSignals: await loadOrganizerThirdPlaceQualifierSignals(db)
      }),
      recalculatedAt: '2026-06-25T20:01:00.000Z'
    });
    const secondRebuild = rebuildLeaderboard({
      players,
      predictions: [],
      results: [],
      groupPredictions,
      actualGroupStandings: await buildActualGroupStandings(db, {
        confirmedThirdPlaceQualifierSignals: await loadOrganizerThirdPlaceQualifierSignals(db)
      }),
      recalculatedAt: '2026-06-25T20:02:00.000Z'
    });

    expect(firstRebuild.entries[0]?.groupBonusPoints).toBe(18);
    expect(secondRebuild.entries[0]?.groupBonusPoints).toBe(18);
    expect((await listThirdPlaceQualifierLocks(db))[0]).toMatchObject({
      group: 'B',
      teamId: 'B3',
      note: 'Locked by organizer'
    });
  });

  it('removes a confirmed organizer lock by group', async () => {
    const db = createTestDb();
    await seedFinalGroup(db, 'B', [
      ['B1', 'B2', 1, 0],
      ['B1', 'B3', 1, 0],
      ['B1', 'B4', 1, 0],
      ['B2', 'B3', 1, 0],
      ['B2', 'B4', 1, 0],
      ['B3', 'B4', 1, 0]
    ]);

    await upsertThirdPlaceQualifierLock(db, { group: 'B', teamId: 'B3' }, new Date('2026-06-25T20:00:00.000Z'));
    expect(await listThirdPlaceQualifierLocks(db)).toHaveLength(1);

    await deleteThirdPlaceQualifierLockForGroup(db, 'B');

    expect(await listThirdPlaceQualifierLocks(db)).toEqual([]);
    expect(await loadOrganizerThirdPlaceQualifierSignals(db)).toEqual([]);
  });
});

function createTestDb(): QueryableDatabase {
  const state = {
    teams: [] as Array<{ id: string; name: string; name_et: string; code?: string; group_id: string }>,
    matches: [] as Array<{ id: number; group_id: string; home_team_id: string; away_team_id: string }>,
    results: [] as Array<{ match_id: number; home_score: number; away_score: number; confirmed_home_score: number; confirmed_away_score: number; public_status: string; is_final: number }>,
    locks: [] as Array<{ group_id: string; team_id: string; status: string; source: string; note: string | null; locked_at: string; updated_at: string }>
  };

  return {
    provider: 'sqlite',
    async run(sql, values = []) {
      if (sql.includes('INSERT OR REPLACE INTO teams')) {
        const [id, name, nameEt, code, groupId] = values as [string, string, string, string, string];
        upsertByKey(state.teams, { id, name, name_et: nameEt, code, group_id: groupId }, 'id');
        return;
      }
      if (sql.includes('INSERT OR REPLACE INTO matches')) {
        const [id, groupId, , homeTeamId, awayTeamId] = values as [number, string, string, string, string];
        upsertByKey(state.matches, { id, group_id: groupId, home_team_id: homeTeamId, away_team_id: awayTeamId }, 'id');
        return;
      }
      if (sql.includes('INSERT OR REPLACE INTO match_results')) {
        const [matchId, homeScore, awayScore, confirmedHomeScore, confirmedAwayScore] = values as [number, number, number, number, number];
        upsertByKey(state.results, {
          match_id: matchId,
          home_score: homeScore,
          away_score: awayScore,
          confirmed_home_score: confirmedHomeScore,
          confirmed_away_score: confirmedAwayScore,
          public_status: 'CONFIRMED_FINAL',
          is_final: 1
        }, 'match_id');
        return;
      }
      if (sql.includes('INSERT INTO third_place_qualifier_locks')) {
        const [groupId, teamId, status, source, note, lockedAt, updatedAt] = values as [string, string, string, string, string | null, string, string];
        const existing = state.locks.find((row) => row.group_id === groupId && row.team_id === teamId);
        if (existing) {
          existing.status = status;
          existing.source = source;
          existing.note = note;
          existing.updated_at = updatedAt;
        } else {
          state.locks.push({
            group_id: groupId,
            team_id: teamId,
            status,
            source,
            note,
            locked_at: lockedAt,
            updated_at: updatedAt
          });
        }
        return;
      }
      if (sql.includes('DELETE FROM third_place_qualifier_locks')) {
        const [groupId] = values as [string];
        state.locks = state.locks.filter((row) => row.group_id !== groupId);
      }
    },
    async all(sql, values = []) {
      if (sql.startsWith('PRAGMA table_info(')) return [];
      if (sql.includes('SELECT id, name, name_et, group_id') && sql.includes('FROM teams')) {
        return state.teams.map((team) => ({
          id: team.id,
          name: team.name,
          name_et: team.name_et,
          group_id: team.group_id
        }));
      }
      if (sql.includes('FROM matches m') && sql.includes("WHERE m.stage = 'GROUP'")) {
        return state.matches.map((match) => {
          const result = state.results.find((row) => row.match_id === match.id);
          return {
            group_id: match.group_id,
            home_team_id: match.home_team_id,
            away_team_id: match.away_team_id,
            confirmed_home_score: result?.confirmed_home_score ?? null,
            confirmed_away_score: result?.confirmed_away_score ?? null,
            public_status: result?.public_status,
            is_final: result?.is_final ?? 0
          };
        });
      }
      if (sql.includes('FROM third_place_qualifier_locks locks') && sql.includes('ORDER BY locks.group_id ASC')) {
        return [...state.locks]
          .sort((left, right) => left.group_id.localeCompare(right.group_id, 'et') || left.team_id.localeCompare(right.team_id, 'et'))
          .map((lock) => {
            const team = state.teams.find((candidate) => candidate.id === lock.team_id);
            return {
              group_id: lock.group_id,
              team_id: lock.team_id,
              team_name: team?.name_et ?? team?.name ?? lock.team_id,
              status: lock.status,
              source: lock.source,
              note: lock.note,
              locked_at: lock.locked_at,
              updated_at: lock.updated_at
            };
          });
      }
      return [];
    },
    async one(sql, values = []) {
      if (sql.includes('FROM teams') && sql.includes('WHERE id = ?')) {
        const team = state.teams.find((candidate) => candidate.id === values[0]);
        return team ? {
          id: team.id,
          team_name: team.name_et ?? team.name,
          group_id: team.group_id
        } : null;
      }
      if (sql.includes('FROM third_place_qualifier_locks locks') && sql.includes('WHERE locks.group_id = ? AND locks.team_id = ?')) {
        const [groupId, teamId] = values as [string, string];
        const lock = state.locks.find((row) => row.group_id === groupId && row.team_id === teamId);
        if (!lock) return null;
        const team = state.teams.find((candidate) => candidate.id === teamId);
        return {
          group_id: lock.group_id,
          team_id: lock.team_id,
          team_name: team?.name_et ?? team?.name ?? lock.team_id,
          status: lock.status,
          source: lock.source,
          note: lock.note,
          locked_at: lock.locked_at,
          updated_at: lock.updated_at
        };
      }
      const rows = await this.all(sql, values);
      return rows[0] ?? null;
    },
    async exec() {},
    async transaction<T>(callback: (tx: QueryableDatabase) => Promise<T>) {
      return callback(this);
    },
    async close() {}
  };
}

async function seedFinalGroup(
  db: QueryableDatabase,
  group: 'B' | 'C',
  scoreRows: Array<[string, string, number, number]>
): Promise<void> {
  const teams = group === 'B'
    ? [
      { id: 'B1', name: 'Switzerland', nameEt: 'Šveits', code: 'SUI' },
      { id: 'B2', name: 'Canada', nameEt: 'Kanada', code: 'CAN' },
      { id: 'B3', name: 'Bosnia and Herzegovina', nameEt: 'Bosnia ja Hertsegoviina', code: 'BIH' },
      { id: 'B4', name: 'Qatar', nameEt: 'Katar', code: 'QAT' }
    ]
    : [
      { id: 'C1', name: 'Brazil', nameEt: 'Brasiilia', code: 'BRA' },
      { id: 'C2', name: 'Morocco', nameEt: 'Maroko', code: 'MAR' },
      { id: 'C3', name: 'Ecuador', nameEt: 'Ecuador', code: 'ECU' },
      { id: 'C4', name: 'Haiti', nameEt: 'Haiti', code: 'HAI' }
    ];

  for (const team of teams) {
    await db.run(
      `INSERT OR REPLACE INTO teams (id, name, name_et, code, group_id) VALUES (?, ?, ?, ?, ?)`,
      [team.id, team.name, team.nameEt, team.code, group]
    );
  }

  let matchIdBase = group === 'B' ? 200 : 300;
  for (const [homeTeamId, awayTeamId, homeScore, awayScore] of scoreRows) {
    matchIdBase += 1;
    await db.run(
      `INSERT OR REPLACE INTO matches (
        id, stage, group_id, kickoff_at, home_team_id, away_team_id, home_slot, away_slot
      ) VALUES (?, 'GROUP', ?, ?, ?, ?, ?, ?)`,
      [matchIdBase, group, `2026-06-2${matchIdBase % 10}T12:00:00.000Z`, homeTeamId, awayTeamId, homeTeamId, awayTeamId]
    );
    await db.run(
      `INSERT OR REPLACE INTO match_results (
        match_id, home_score, away_score, status, public_status, is_final, confirmed_home_score, confirmed_away_score, confirmed_at, updated_at
      ) VALUES (?, ?, ?, 'FINISHED', 'CONFIRMED_FINAL', 1, ?, ?, ?, ?)`,
      [matchIdBase, homeScore, awayScore, homeScore, awayScore, '2026-06-25T20:00:00.000Z', '2026-06-25T20:00:00.000Z']
    );
  }
}

function upsertByKey<T extends Record<string, unknown>, K extends keyof T>(rows: T[], row: T, key: K): void {
  const index = rows.findIndex((candidate) => candidate[key] === row[key]);
  if (index >= 0) rows[index] = row;
  else rows.push(row);
}
