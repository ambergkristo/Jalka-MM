import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { createDatabase, type QueryableDatabase } from '../server/databaseAdapter.js';
import { DatabaseResultRepository } from '../server/results/databaseResultRepository.js';
import { MockResultProvider } from '../server/results/mockResultProvider.js';
import { runResultUpdateCycle } from '../server/results/resultAgent.js';
import { getCurrentLeaderboard } from '../server/results/resultAgentRuntime.js';
import { migrateResultPersistenceSchema } from '../server/results/resultPersistenceSchema.js';

describe('persistent result and leaderboard repositories', () => {
  it('creates required persistence tables', async () => {
    await withRepository(async ({ db }) => {
      await migrateResultPersistenceSchema(db);
      const tables = await db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('match_results', 'result_updates', 'leaderboard_entries', 'leaderboard_metadata')");
      assert.deepEqual(tables.map((row) => row.name).sort(), ['leaderboard_entries', 'leaderboard_metadata', 'match_results', 'result_updates']);
    });
  });

  it('upserts match result state and exposes finalized results', async () => {
    await withRepository(async ({ db, repository }) => {
      await seedMatch(db, 4);
      await repository.saveResultUpdate({
        matchId: 4,
        status: 'FINISHED',
        homeScore: 2,
        awayScore: 1,
        minute: 90,
        isFinal: true,
        lastCheckedAt: '2026-06-15T18:00:00.000Z',
        provider: 'mock-result-provider',
        rawProviderStatus: 'finished'
      });

      const result = await repository.getMatchResult(4);
      assert.equal(result?.status, 'FINISHED');
      assert.equal(result?.homeScore, 2);
      assert.equal(result?.awayScore, 1);
      assert.equal(result?.isFinal, true);
      assert.equal((await repository.getFinalizedResults()).length, 1);
    });
  });

  it('replaces leaderboard entries idempotently', async () => {
    await withRepository(async ({ repository }) => {
      const metadata = {
        recalculatedAt: '2026-06-15T18:00:00.000Z',
        playersProcessed: 1,
        matchesProcessed: 1,
        changedEntries: 1,
        warnings: [],
        entries: []
      };
      const entries = [{
        playerId: 'kristo-amberg',
        rank: 1,
        points: 6,
        exactScores: 1,
        correctResults: 1,
        hitRate: 1,
        matchesScored: 1,
        matchPoints: 6,
        groupBonusPoints: 0,
        playoffBonusPoints: 0,
        topScorerBonusPoints: 0,
        totalPoints: 6,
        lastUpdatedAt: '2026-06-15T18:00:00.000Z'
      }];

      await repository.replaceLeaderboard(entries, { ...metadata, entries });
      await repository.replaceLeaderboard(entries, { ...metadata, entries });

      assert.equal((await repository.getLeaderboard()).length, 1);
      assert.equal((await repository.getLeaderboardMetadata()).lastRebuildAt, '2026-06-15T18:00:00.000Z');
    });
  });

  it('result agent persists final results and rebuilt leaderboard without duplicate rows', async () => {
    await withRepository(async ({ db, repository }) => {
      await seedMatch(db, 4);
      const now = new Date('2026-06-15T18:00:00.000Z');

      const first = await runResultUpdateCycle({ repository, leaderboardRepository: repository, provider: new MockResultProvider(), now });
      const second = await runResultUpdateCycle({ repository, leaderboardRepository: repository, provider: new MockResultProvider(), now });

      assert.equal(first.checkedMatches, 1);
      assert.equal(first.updatedMatches, 1);
      assert.equal(first.finalizedMatches, 1);
      assert.equal(first.leaderboardRebuilt, true);
      assert.equal(first.playersProcessed, 24);
      assert.equal(second.leaderboardRebuilt, false);
      assert.equal((await repository.getFinalizedResults()).length, 1);
      assert.equal((await repository.getLeaderboard()).length, 24);
      assert.equal(Number((await db.one('SELECT COUNT(*) AS count FROM leaderboard_entries'))?.count), 24);
      assert.equal(Number((await db.one('SELECT COUNT(*) AS count FROM match_results WHERE match_id = ?', [4]))?.count), 1);
    });
  });

  it('leaderboard API response prefers persisted leaderboard rows', async () => {
    await withRepository(async ({ repository }) => {
      await repository.replaceLeaderboard(
        [{
          playerId: 'kristo-amberg',
          rank: 1,
          points: 12,
          exactScores: 2,
          correctResults: 2,
          hitRate: 1,
          matchesScored: 2,
          matchPoints: 12,
          groupBonusPoints: 0,
          playoffBonusPoints: 0,
          topScorerBonusPoints: 0,
          totalPoints: 12,
          lastUpdatedAt: '2026-06-15T18:00:00.000Z'
        }],
        {
          recalculatedAt: '2026-06-15T18:00:00.000Z',
          playersProcessed: 1,
          matchesProcessed: 2,
          changedEntries: 1,
          entries: [],
          warnings: []
        }
      );

      const response = await getCurrentLeaderboard(repository);
      assert.equal(response.mode, 'persisted');
      assert.equal(response.recalculatedAt, '2026-06-15T18:00:00.000Z');
      assert.equal(response.entries[0]?.playerId, 'kristo-amberg');
      assert.equal(response.entries[0]?.points, 12);
    });
  });
});

async function withRepository(callback: (input: { db: QueryableDatabase; repository: DatabaseResultRepository }) => Promise<void>): Promise<void> {
  const db = createDatabase({
    appEnv: 'local',
    databaseMode: 'sqlite',
    sqlitePath: join(tmpdir(), `jalka-mm-result-persistence-${randomUUID()}.sqlite`),
    publicAppBaseUrl: 'http://localhost:5174',
    tournamentDataMode: 'partial_official',
    allowDestructiveCommands: true,
    allowUnsafeProductionSqlite: false
  });
  const repository = new DatabaseResultRepository(db);
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, name TEXT NOT NULL, name_et TEXT, code TEXT, flag TEXT, group_id TEXT);
      CREATE TABLE IF NOT EXISTS matches (id INTEGER PRIMARY KEY, stage TEXT NOT NULL, group_id TEXT, kickoff_at TEXT NOT NULL, home_team_id TEXT, away_team_id TEXT, home_slot TEXT NOT NULL, away_slot TEXT NOT NULL);
    `);
    await repository.migrate();
    await callback({ db, repository });
  } finally {
    await db.close();
  }
}

async function seedMatch(db: QueryableDatabase, id: number): Promise<void> {
  await db.run(
    `INSERT INTO matches (id, stage, group_id, kickoff_at, home_team_id, away_team_id, home_slot, away_slot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, 'GROUP', 'H', '2026-06-15T15:55:00.000Z', null, null, 'Argentina', 'Korea Republic']
  );
}
