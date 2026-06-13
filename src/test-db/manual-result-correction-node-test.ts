import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { createDatabase, type QueryableDatabase } from '../server/databaseAdapter.js';
import { DatabaseResultRepository } from '../server/results/databaseResultRepository.js';
import { confirmManualResult } from '../server/results/manualResultCorrection.js';
import { resetSimulationState } from '../server/results/matchdaySimulation.js';
import { getPublicTournamentSnapshot } from '../server/results/publicTournamentSnapshot.js';

describe('manual result correction with persistent storage', () => {
  it('persists a manual confirmed result, rebuilds leaderboard, updates public results, and writes audit', async () => {
    await withSimulationDb(async (db) => {
      const repository = new DatabaseResultRepository(db);
      const summary = await confirmManualResult({
        db,
        repository,
        leaderboardRepository: repository,
        confirmation: {
          matchId: 1,
          homeScore: 2,
          awayScore: 1,
          decidedAfter: 'FT',
          source: 'manual',
          confirmedBy: 'test-operator',
          notes: 'Verified from official TV broadcast.',
          now: new Date('2026-06-11T23:59:00.000Z')
        }
      });

      assert.equal(summary.action, 'confirmed');
      assert.equal(summary.leaderboardRebuilt, true);
      assert.equal(summary.playersProcessed, 109);
      const result = await repository.getMatchResult(1);
      assert.equal(result?.publicStatus, 'CONFIRMED_FINAL');
      assert.equal(result?.confirmedHomeScore, 2);
      assert.equal(result?.confirmedAwayScore, 1);
      assert.equal(result?.confirmationSource, 'manual');
      assert.equal(result?.confirmationConfidence, 'manual');
      assert.equal((await repository.getLeaderboard()).length, 109);
      const snapshot = await getPublicTournamentSnapshot(db);
      assert.equal(snapshot.latestResults.some((match) => match.id === '1' && match.homeScore === 2 && match.awayScore === 1), true);
      assert.equal(Number((await db.one('SELECT COUNT(*) AS count FROM result_manual_corrections'))?.count), 1);
    });
  });

  it('persists manual scorers and updates the public top scorers table', async () => {
    await withSimulationDb(async (db) => {
      const repository = new DatabaseResultRepository(db);
      await confirmManualResult({
        db,
        repository,
        leaderboardRepository: repository,
        confirmation: {
          matchId: 1,
          homeScore: 2,
          awayScore: 1,
          source: 'manual',
          confirmedBy: 'test-operator',
          scorers: [{
            playerName: 'Santiago Gimenez',
            teamCode: 'MEX',
            goals: 2
          }],
          now: new Date('2026-06-11T23:59:00.000Z')
        }
      });

      const scorerRow = await db.one('SELECT player_name, team_id, team_code, goals FROM result_manual_scorers WHERE match_id = ?', [1]);
      const topScorerRow = await db.one('SELECT player_name, team_id, goals, rank FROM top_scorer_standings WHERE player_name = ?', ['Santiago Gimenez']);
      assert.equal(scorerRow?.player_name, 'Santiago Gimenez');
      assert.equal(scorerRow?.team_code, 'MEX');
      assert.equal(Number(scorerRow?.goals), 2);
      assert.equal(topScorerRow?.player_name, 'Santiago Gimenez');
      assert.equal(Number(topScorerRow?.goals), 2);
      assert.equal(Number(topScorerRow?.rank), 1);
      assert.equal(String((await db.one('SELECT scorers_json FROM result_manual_corrections ORDER BY created_at DESC LIMIT 1'))?.scorers_json ?? ''), JSON.stringify([{ playerName: 'Santiago Gimenez', teamCode: 'MEX', goals: 2 }]));
    });
  });

  it('is idempotent for the same confirmed score and does not duplicate leaderboard rows', async () => {
    await withSimulationDb(async (db) => {
      const repository = new DatabaseResultRepository(db);
      const confirmation = {
        matchId: 1,
        homeScore: 2,
        awayScore: 1,
        source: 'manual',
        confirmedBy: 'test-operator',
        now: new Date('2026-06-11T23:59:00.000Z')
      };

      await confirmManualResult({ db, repository, leaderboardRepository: repository, confirmation });
      const repeated = await confirmManualResult({ db, repository, leaderboardRepository: repository, confirmation: { ...confirmation, now: new Date('2026-06-12T00:01:00.000Z') } });

      assert.equal(repeated.action, 'idempotent');
      assert.equal(repeated.leaderboardRebuilt, false);
      assert.equal(Number((await db.one('SELECT COUNT(*) AS count FROM leaderboard_entries'))?.count), 109);
    });
  });

  it('corrects an existing confirmed score and rebuilds leaderboard', async () => {
    await withSimulationDb(async (db) => {
      const repository = new DatabaseResultRepository(db);
      await confirmManualResult({
        db,
        repository,
        leaderboardRepository: repository,
        confirmation: { matchId: 1, homeScore: 2, awayScore: 1, source: 'manual', confirmedBy: 'test-operator', now: new Date('2026-06-11T23:59:00.000Z') }
      });
      const corrected = await confirmManualResult({
        db,
        repository,
        leaderboardRepository: repository,
        confirmation: { matchId: 1, homeScore: 1, awayScore: 1, source: 'manual', confirmedBy: 'test-operator', notes: 'Score corrected after review.', now: new Date('2026-06-12T00:05:00.000Z') }
      });

      assert.equal(corrected.action, 'corrected');
      assert.equal(corrected.previousHomeScore, 2);
      assert.equal(corrected.previousAwayScore, 1);
      assert.equal(corrected.leaderboardRebuilt, true);
      const result = await repository.getMatchResult(1);
      assert.equal(result?.confirmedHomeScore, 1);
      assert.equal(result?.confirmedAwayScore, 1);
      assert.equal(Number((await db.one('SELECT COUNT(*) AS count FROM result_manual_corrections'))?.count), 2);
      assert.equal(Number((await db.one('SELECT COUNT(*) AS count FROM leaderboard_entries'))?.count), 109);
    });
  });

  it('replaces previously stored manual scorers for the same match', async () => {
    await withSimulationDb(async (db) => {
      const repository = new DatabaseResultRepository(db);
      await confirmManualResult({
        db,
        repository,
        leaderboardRepository: repository,
        confirmation: {
          matchId: 1,
          homeScore: 2,
          awayScore: 1,
          source: 'manual',
          confirmedBy: 'test-operator',
          scorers: [{ playerName: 'Santiago Gimenez', teamCode: 'MEX', goals: 1 }],
          now: new Date('2026-06-11T23:59:00.000Z')
        }
      });
      await confirmManualResult({
        db,
        repository,
        leaderboardRepository: repository,
        confirmation: {
          matchId: 1,
          homeScore: 1,
          awayScore: 1,
          source: 'manual',
          confirmedBy: 'test-operator',
          scorers: [{ playerName: 'Raul Jimenez', teamCode: 'MEX', goals: 1 }],
          now: new Date('2026-06-12T00:05:00.000Z')
        }
      });

      const manualScorers = await db.all('SELECT player_name, goals FROM result_manual_scorers WHERE match_id = ? ORDER BY player_name', [1]);
      const topScorers = await db.all('SELECT player_name, goals FROM top_scorer_standings ORDER BY rank, player_name');
      assert.equal(manualScorers.length, 1);
      assert.equal(String(manualScorers[0]?.player_name), 'Raul Jimenez');
      assert.equal(Number(manualScorers[0]?.goals), 1);
      assert.equal(topScorers.length, 1);
      assert.equal(String(topScorers[0]?.player_name), 'Raul Jimenez');
      assert.equal(Number(topScorers[0]?.goals), 1);
    });
  });

  it('fails safely for invalid match ids and scores', async () => {
    await withSimulationDb(async (db) => {
      const repository = new DatabaseResultRepository(db);
      await assert.rejects(
        () => confirmManualResult({ db, repository, leaderboardRepository: repository, confirmation: { matchId: 9999, homeScore: 1, awayScore: 0 } }),
        /Match 9999 does not exist/
      );
      await assert.rejects(
        () => confirmManualResult({ db, repository, leaderboardRepository: repository, confirmation: { matchId: 1, homeScore: -1, awayScore: 0 } }),
        /homeScore must be a non-negative integer/
      );
    });
  });

  it('clears NEEDS_REVIEW state when a manual result confirms the match', async () => {
    await withSimulationDb(async (db) => {
      const repository = new DatabaseResultRepository(db);
      await repository.saveResultUpdate({
        matchId: 1,
        status: 'FINISHED',
        publicStatus: 'NEEDS_REVIEW',
        homeScore: 2,
        awayScore: 1,
        provisionalHomeScore: 2,
        provisionalAwayScore: 1,
        provisionalStatus: 'FINISHED',
        isFinal: false,
        lastCheckedAt: '2026-06-11T23:40:00.000Z',
        provider: 'provider-chain',
        needsReviewReason: 'Provider final scores disagree for match 1.'
      });

      const summary = await confirmManualResult({
        db,
        repository,
        leaderboardRepository: repository,
        confirmation: { matchId: 1, homeScore: 2, awayScore: 1, source: 'manual', confirmedBy: 'test-operator', now: new Date('2026-06-11T23:59:00.000Z') }
      });

      assert.equal(summary.clearedNeedsReview, true);
      const result = await repository.getMatchResult(1);
      assert.equal(result?.publicStatus, 'CONFIRMED_FINAL');
      assert.equal(result?.needsReviewReason, undefined);
    });
  });

  it('simulation reset clears manual correction runtime state', async () => {
    await withSimulationDb(async (db) => {
      const repository = new DatabaseResultRepository(db);
      await confirmManualResult({
        db,
        repository,
        leaderboardRepository: repository,
        confirmation: { matchId: 1, homeScore: 2, awayScore: 1, source: 'manual', confirmedBy: 'test-operator' }
      });
      await resetSimulationState(db, { seedSchedule: true });

      assert.equal(Number((await db.one('SELECT COUNT(*) AS count FROM match_results'))?.count), 0);
      assert.equal(Number((await db.one('SELECT COUNT(*) AS count FROM leaderboard_entries'))?.count), 0);
      assert.equal(Number((await db.one('SELECT COUNT(*) AS count FROM result_manual_corrections'))?.count), 0);
    });
  });
});

async function withSimulationDb(callback: (db: QueryableDatabase) => Promise<void>): Promise<void> {
  const db = createDatabase({
    appEnv: 'local',
    databaseMode: 'sqlite',
    sqlitePath: join(tmpdir(), `jalka-mm-manual-result-${randomUUID()}.sqlite`),
    publicAppBaseUrl: 'http://localhost:5174',
    tournamentDataMode: 'partial_official',
    allowDestructiveCommands: true,
    allowUnsafeProductionSqlite: false
  });
  try {
    await resetSimulationState(db, { seedSchedule: true });
    await callback(db);
  } finally {
    await db.close();
  }
}
