import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { createDatabase, type QueryableDatabase } from '../server/databaseAdapter.js';
import { DatabaseResultRepository } from '../server/results/databaseResultRepository.js';
import { MockResultProvider } from '../server/results/mockResultProvider.js';
import { getPublicTournamentSnapshot } from '../server/results/publicTournamentSnapshot.js';
import { runResultUpdateCycle } from '../server/results/resultAgent.js';
import { toResultUpdate, type ResultProvider } from '../server/results/resultProvider.js';
import { getCurrentLeaderboard } from '../server/results/resultAgentRuntime.js';
import { migrateResultPersistenceSchema } from '../server/results/resultPersistenceSchema.js';
import { predictionRepository } from '../domain/predictionRepository.js';

describe('persistent result and leaderboard repositories', () => {
  it('creates required persistence tables', async () => {
    await withRepository(async ({ db }) => {
      await migrateResultPersistenceSchema(db);
      const tables = await db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('match_results', 'result_updates', 'leaderboard_entries', 'leaderboard_metadata')");
      assert.deepEqual(tables.map((row) => row.name).sort(), ['leaderboard_entries', 'leaderboard_metadata', 'match_results', 'result_updates']);
      const columns = await db.all('PRAGMA table_info(match_results)');
      assert.ok(columns.some((row) => row.name === 'public_status'));
      assert.ok(columns.some((row) => row.name === 'provisional_home_score'));
      assert.ok(columns.some((row) => row.name === 'confirmed_home_score'));
      assert.ok(columns.some((row) => row.name === 'provider_results_json'));
    });
  });

  it('upserts confirmed match result state and exposes finalized results', async () => {
    await withRepository(async ({ db, repository }) => {
      await seedMatch(db, 4);
      await repository.saveResultUpdate({
        matchId: 4,
        status: 'FINISHED',
        publicStatus: 'CONFIRMED_FINAL',
        homeScore: 2,
        awayScore: 1,
        confirmedHomeScore: 2,
        confirmedAwayScore: 1,
        confirmedAt: '2026-06-15T18:11:00.000Z',
        confirmationSource: 'mock-result-provider',
        confirmationConfidence: 'provider-repeat',
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
      assert.equal(result?.publicStatus, 'CONFIRMED_FINAL');
      assert.equal((await repository.getFinalizedResults()).length, 1);
    });
  });

  it('persists provisional final state without exposing finalized results', async () => {
    await withRepository(async ({ db, repository }) => {
      await seedMatch(db, 4);
      await repository.saveResultUpdate({
        matchId: 4,
        status: 'FINISHED',
        publicStatus: 'CONFIRMING',
        homeScore: 2,
        awayScore: 1,
        provisionalHomeScore: 2,
        provisionalAwayScore: 1,
        provisionalStatus: 'FINISHED',
        minute: 90,
        isFinal: false,
        lastCheckedAt: '2026-06-15T18:00:00.000Z',
        nextConfirmationCheckAt: '2026-06-15T18:10:00.000Z',
        nextCheckAt: '2026-06-15T18:10:00.000Z',
        provider: 'mock-result-provider',
        rawProviderStatus: 'finished',
        providerResults: [{
          provider: 'mock-result-provider',
          matchId: 4,
          status: 'FINISHED',
          homeScore: 2,
          awayScore: 1,
          isFinal: true,
          observedAt: '2026-06-15T18:00:00.000Z'
        }]
      });

      const result = await repository.getMatchResult(4);
      assert.equal(result?.publicStatus, 'CONFIRMING');
      assert.equal(result?.isFinal, false);
      assert.equal(result?.provisionalHomeScore, 2);
      assert.equal(result?.nextConfirmationCheckAt, '2026-06-15T18:10:00.000Z');
      assert.equal((await repository.getProviderResultObservations(4)).length, 1);
      assert.equal((await repository.getFinalizedResults()).length, 0);
    });
  });

  it('exposes live provisional scores without finalizing public results', async () => {
    await withRepository(async ({ db, repository }) => {
      await db.run(
        `INSERT INTO matches (id, stage, group_id, kickoff_at, home_team_id, away_team_id, home_slot, away_slot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [8, 'GROUP', 'C', '2026-06-13T18:00:00.000Z', null, null, 'Canada', 'Bosnia and Herzegovina']
      );
      await db.run(
        `INSERT INTO matches (id, stage, group_id, kickoff_at, home_team_id, away_team_id, home_slot, away_slot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [9, 'GROUP', 'C', '2026-06-20T18:00:00.000Z', null, null, 'Brazil', 'Croatia']
      );
      await repository.saveResultUpdate({
        matchId: 8,
        status: 'LIVE',
        publicStatus: 'LIVE',
        homeScore: 1,
        awayScore: 0,
        provisionalHomeScore: 1,
        provisionalAwayScore: 0,
        provisionalStatus: 'LIVE',
        minute: 52,
        isFinal: false,
        lastCheckedAt: '2026-06-13T18:52:00.000Z',
        nextCheckAt: '2026-06-13T18:55:00.000Z',
        provider: 'mock-result-provider',
        rawProviderStatus: 'LIVE'
      });
      await repository.saveResultUpdate({
        matchId: 9,
        status: 'SCHEDULED',
        publicStatus: 'SCHEDULED',
        homeScore: 0,
        awayScore: 0,
        isFinal: false,
        lastCheckedAt: '2026-06-13T18:52:00.000Z',
        provider: 'mock-result-provider',
        rawProviderStatus: 'SCHEDULED'
      });

      const snapshot = await getPublicTournamentSnapshot(db);
      const liveMatch = snapshot.liveMatches.find((match) => match.id === '8');
      const futureMatch = snapshot.upcomingMatches.find((match) => match.id === '9');

      assert.equal(liveMatch?.homeScore, 1);
      assert.equal(liveMatch?.awayScore, 0);
      assert.equal(liveMatch?.status, 'live');
      assert.equal(futureMatch?.homeScore, undefined);
      assert.equal(futureMatch?.awayScore, undefined);
      assert.equal(snapshot.latestResults.length, 0);
      assert.equal((await repository.getFinalizedResults()).length, 0);
    });
  });

  it('persists live scorer standings without rebuilding prediction leaderboard scores', async () => {
    await withRepository(async ({ db, repository }) => {
      await db.run(`INSERT INTO teams (id, name, name_et, code, flag, group_id) VALUES (?, ?, ?, ?, ?, ?)`, ['mex', 'Mexico', 'Mehhiko', 'MEX', '', 'A']);
      await db.run(`INSERT INTO teams (id, name, name_et, code, flag, group_id) VALUES (?, ?, ?, ?, ?, ?)`, ['rsa', 'South Africa', 'LĆµuna-Aafrika Vabariik', 'RSA', '', 'A']);
      await db.run(
        `INSERT INTO matches (id, stage, group_id, kickoff_at, home_team_id, away_team_id, home_slot, away_slot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [10, 'GROUP', 'A', '2026-06-13T18:00:00.000Z', 'mex', 'rsa', 'Mexico', 'South Africa']
      );
      const now = new Date('2026-06-13T18:30:00.000Z');
      const provider: ResultProvider = {
        name: 'open-worldcup-result-provider',
        mode: 'live',
        async fetchMatchUpdate(match, now) {
          return toResultUpdate({
            match,
            provider: 'open-worldcup-result-provider',
            providerStatus: 'LIVE',
            now,
            homeScore: 1,
            awayScore: 0,
            minute: 30,
            providerMatchId: '10',
            scorers: [{ playerName: 'Santiago Gimenez', teamName: 'Mexico', goals: 1 }]
          });
        }
      };

      const summary = await runResultUpdateCycle({ repository, leaderboardRepository: repository, provider, now });
      const scorerRow = await db.one('SELECT player_name, team_id, goals FROM result_manual_scorers WHERE match_id = ?', [10]);
      const standingsRow = await db.one('SELECT player_name, team_id, goals FROM top_scorer_standings ORDER BY rank LIMIT 1');
      const snapshot = await getPublicTournamentSnapshot(db);

      assert.equal(summary.finalizedResults, 0);
      assert.equal(summary.leaderboardRebuilt, false);
      assert.equal(String(scorerRow?.player_name), 'Santiago Gimenez');
      assert.equal(String(scorerRow?.team_id), 'mex');
      assert.equal(Number(scorerRow?.goals), 1);
      assert.equal(String(standingsRow?.player_name), 'Santiago Gimenez');
      assert.equal(Number(standingsRow?.goals), 1);
      assert.equal(snapshot.topScorers[0]?.player, 'Santiago Gimenez');
      assert.equal(snapshot.topScorers[0]?.goals, 1);
      assert.equal(Number((await db.one('SELECT COUNT(*) AS count FROM leaderboard_entries'))?.count), 0);
      assert.equal((await repository.getFinalizedResults()).length, 0);
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

  it('updates leaderboard entries and prunes stale rows without duplicate inserts', async () => {
    await withRepository(async ({ db, repository }) => {
      const metadata = {
        recalculatedAt: '2026-06-15T18:00:00.000Z',
        playersProcessed: 2,
        matchesProcessed: 1,
        changedEntries: 2,
        warnings: [],
        entries: []
      };
      const staleEntries = [
        leaderboardEntry('kristo-amberg', 1, 6),
        leaderboardEntry('old-player', 2, 2)
      ];
      const repairedEntries = [
        leaderboardEntry('kristo-amberg', 1, 8)
      ];

      await repository.replaceLeaderboard(staleEntries, { ...metadata, entries: staleEntries });
      await repository.replaceLeaderboard(repairedEntries, { ...metadata, entries: repairedEntries });

      const rows = await repository.getLeaderboard();
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.playerId, 'kristo-amberg');
      assert.equal(rows[0]?.points, 8);
      assert.equal(Number((await db.one('SELECT COUNT(*) AS count FROM leaderboard_entries'))?.count), 1);
    });
  });

  it('result agent persists final results and rebuilt leaderboard without duplicate rows', async () => {
    await withRepository(async ({ db, repository }) => {
      await seedMatch(db, 4);
      const now = new Date('2026-06-15T18:00:00.000Z');

      const first = await runResultUpdateCycle({ repository, leaderboardRepository: repository, provider: new MockResultProvider(), now, confirmationDelayMinutes: 10 });
      const second = await runResultUpdateCycle({ repository, leaderboardRepository: repository, provider: new MockResultProvider(), now: new Date('2026-06-15T18:11:00.000Z'), confirmationDelayMinutes: 10 });

      assert.equal(first.checkedMatches, 1);
      assert.equal(first.updatedMatches, 1);
      assert.equal(first.finalizedMatches, 0);
      assert.equal(first.confirmationPending, 1);
      assert.equal(first.leaderboardRebuilt, false);
      assert.equal(second.finalizedMatches, 1);
      assert.equal(second.leaderboardRebuilt, true);
      assert.equal(second.playersProcessed, 109);
      assert.equal((await repository.getFinalizedResults()).length, 1);
      assert.equal((await repository.getLeaderboard()).length, 109);
      assert.equal(Number((await db.one('SELECT COUNT(*) AS count FROM leaderboard_entries'))?.count), 109);
      assert.equal(Number((await db.one('SELECT COUNT(*) AS count FROM match_results WHERE match_id = ?', [4]))?.count), 1);
    });
  });

  it('public tournament snapshot recalculates group standings from confirmed results even if persisted standings are stale', async () => {
    await withRepository(async ({ db, repository }) => {
      await db.run(`INSERT INTO teams (id, name, name_et, code, flag, group_id) VALUES (?, ?, ?, ?, ?, ?)`, ['mex', 'Mexico', 'Mehhiko', 'MEX', '', 'A']);
      await db.run(`INSERT INTO teams (id, name, name_et, code, flag, group_id) VALUES (?, ?, ?, ?, ?, ?)`, ['rsa', 'South Africa', 'Lõuna-Aafrika Vabariik', 'RSA', '', 'A']);
      await db.run(`INSERT INTO matches (id, stage, group_id, kickoff_at, home_team_id, away_team_id, home_slot, away_slot) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
        1,
        'GROUP',
        'A',
        '2026-06-11T19:00:00.000Z',
        'mex',
        'rsa',
        'Mexico',
        'South Africa'
      ]);
      await db.run(`INSERT INTO group_standings (group_id, team_id, rank, played, wins, draws, losses, goals_for, goals_against, goal_difference, points, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['A', 'mex', 1, 0, 0, 0, 0, 0, 0, 0, 0, '2026-06-11T18:00:00.000Z']);
      await db.run(`INSERT INTO group_standings (group_id, team_id, rank, played, wins, draws, losses, goals_for, goals_against, goal_difference, points, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['A', 'rsa', 2, 0, 0, 0, 0, 0, 0, 0, 0, '2026-06-11T18:00:00.000Z']);

      await repository.saveResultUpdate({
        matchId: 1,
        status: 'FINISHED',
        publicStatus: 'CONFIRMED_FINAL',
        homeScore: 2,
        awayScore: 0,
        confirmedHomeScore: 2,
        confirmedAwayScore: 0,
        confirmedAt: '2026-06-11T21:15:00.000Z',
        confirmationSource: 'mock-result-provider',
        confirmationConfidence: 'provider-repeat',
        minute: 90,
        isFinal: true,
        lastCheckedAt: '2026-06-11T21:15:00.000Z',
        provider: 'mock-result-provider',
        rawProviderStatus: 'finished'
      });

      const snapshot = await getPublicTournamentSnapshot(db);
      const groupA = snapshot.groupStandings.find((group) => group.group === 'A');

      assert.equal(groupA?.teams[0]?.team, 'Mexico');
      assert.equal(groupA?.teams[0]?.points, 3);
      assert.equal(groupA?.teams[0]?.played, 1);
      assert.equal(snapshot.latestResults.length, 1);
    });
  });

  it('public tournament snapshot completed count is not capped by latest results', async () => {
    await withRepository(async ({ db, repository }) => {
      for (let id = 1; id <= 104; id += 1) {
        await db.run(
          `INSERT INTO matches (id, stage, group_id, kickoff_at, home_team_id, away_team_id, home_slot, away_slot)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, 'GROUP', 'A', new Date(Date.UTC(2026, 5, 11, id % 24, 0, 0)).toISOString(), null, null, `Home ${id}`, `Away ${id}`]
        );
      }

      const rawStatuses = ['FT', 'AET', 'PEN', 'FINISHED'];
      for (let id = 1; id <= 16; id += 1) {
        await repository.saveResultUpdate({
          matchId: id,
          status: 'FINISHED',
          publicStatus: 'CONFIRMED_FINAL',
          homeScore: id % 3,
          awayScore: (id + 1) % 3,
          confirmedHomeScore: id % 3,
          confirmedAwayScore: (id + 1) % 3,
          confirmedAt: new Date(Date.UTC(2026, 5, 12, id % 24, 30, 0)).toISOString(),
          confirmationSource: 'mock-result-provider',
          confirmationConfidence: 'provider-repeat',
          minute: id % 4 === 2 ? 120 : 90,
          isFinal: true,
          lastCheckedAt: new Date(Date.UTC(2026, 5, 12, id % 24, 30, 0)).toISOString(),
          provider: 'mock-result-provider',
          rawProviderStatus: rawStatuses[id % rawStatuses.length]
        });
      }

      const snapshot = await getPublicTournamentSnapshot(db);
      const playedMetric = snapshot.tournamentSummary.find((metric) => metric.label === 'Mängitud');

      assert.equal(snapshot.latestResults.length, 8);
      assert.equal(snapshot.completedMatchesCount, 16);
      assert.equal(snapshot.totalMatchesCount, 104);
      assert.equal(playedMetric?.value, '16 / 104');
      assert.equal(snapshot.tournamentProgressByStage.find((stage) => stage.stage === 'Alagrupid')?.completed, 16);
    });
  });

  it('counts completed matches even when the public status string is not the exact canonical final label', async () => {
    await withRepository(async ({ db, repository }) => {
      await db.run(
        `INSERT INTO matches (id, stage, group_id, kickoff_at, home_team_id, away_team_id, home_slot, away_slot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [16, 'GROUP', 'B', '2026-06-12T19:00:00.000Z', null, null, 'Belgium', 'Egypt']
      );

      await repository.saveResultUpdate({
        matchId: 16,
        status: 'FINISHED',
        publicStatus: 'FINISHED' as never,
        homeScore: 1,
        awayScore: 1,
        confirmedHomeScore: 1,
        confirmedAwayScore: 1,
        confirmedAt: '2026-06-12T21:05:00.000Z',
        confirmationSource: 'mock-result-provider',
        confirmationConfidence: 'provider-repeat',
        minute: 90,
        isFinal: true,
        lastCheckedAt: '2026-06-12T21:05:00.000Z',
        provider: 'mock-result-provider',
        rawProviderStatus: 'TRUE'
      });

      const snapshot = await getPublicTournamentSnapshot(db);

      assert.equal(snapshot.latestResults.length, 1);
      assert.equal(snapshot.completedMatchesCount, 1);
      assert.equal(snapshot.latestResults[0]?.homeTeam, 'Belgium');
      assert.equal(snapshot.latestResults[0]?.awayTeam, 'Egypt');
    });
  });

  it('keeps finalized and confirming final-score matches out of today matches while preserving scheduled matches later today', async () => {
    await withRepository(async ({ db, repository }) => {
      await db.run(
        `INSERT INTO matches (id, stage, group_id, kickoff_at, home_team_id, away_team_id, home_slot, away_slot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [21, 'GROUP', 'H', '2026-06-21T10:00:00.000Z', null, null, 'Home 21', 'Away 21']
      );
      await db.run(
        `INSERT INTO matches (id, stage, group_id, kickoff_at, home_team_id, away_team_id, home_slot, away_slot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [22, 'GROUP', 'H', '2026-06-21T13:00:00.000Z', null, null, 'Home 22', 'Away 22']
      );
      await db.run(
        `INSERT INTO matches (id, stage, group_id, kickoff_at, home_team_id, away_team_id, home_slot, away_slot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [23, 'GROUP', 'H', '2026-06-21T18:00:00.000Z', null, null, 'Home 23', 'Away 23']
      );

      await repository.saveResultUpdate({
        matchId: 21,
        status: 'FINISHED',
        publicStatus: 'CONFIRMED_FINAL',
        homeScore: 3,
        awayScore: 0,
        confirmedHomeScore: 3,
        confirmedAwayScore: 0,
        confirmedAt: '2026-06-21T11:55:00.000Z',
        confirmationSource: 'mock-result-provider',
        confirmationConfidence: 'provider-repeat',
        minute: 90,
        isFinal: true,
        lastCheckedAt: '2026-06-21T11:55:00.000Z',
        provider: 'mock-result-provider',
        rawProviderStatus: 'finished'
      });
      await repository.saveResultUpdate({
        matchId: 22,
        status: 'FINISHED',
        publicStatus: 'CONFIRMING',
        homeScore: 2,
        awayScore: 1,
        provisionalHomeScore: 2,
        provisionalAwayScore: 1,
        provisionalStatus: 'FINISHED',
        minute: 90,
        isFinal: false,
        lastCheckedAt: '2026-06-21T14:55:00.000Z',
        nextConfirmationCheckAt: '2026-06-21T15:05:00.000Z',
        nextCheckAt: '2026-06-21T15:05:00.000Z',
        provider: 'mock-result-provider',
        rawProviderStatus: 'finished'
      });
      await repository.saveResultUpdate({
        matchId: 23,
        status: 'SCHEDULED',
        publicStatus: 'SCHEDULED',
        isFinal: false,
        lastCheckedAt: '2026-06-21T14:55:00.000Z',
        provider: 'mock-result-provider',
        rawProviderStatus: 'scheduled'
      });

      const snapshot = await getPublicTournamentSnapshot(db, new Date('2026-06-21T15:00:00.000Z'));
      const todayIds = snapshot.todayMatches.map((match) => match.id);
      const latestIds = snapshot.latestResults.map((match) => match.id);

      assert.equal(todayIds.includes('21'), false);
      assert.equal(todayIds.includes('22'), false);
      assert.equal(todayIds.includes('23'), true);
      assert.equal(latestIds.includes('21'), true);
      assert.equal(snapshot.latestResults.find((match) => match.id === '21')?.homeScore, 3);
      assert.deepEqual(todayIds.filter((id) => latestIds.includes(id)), []);
    });
  });

  it('builds the public snapshot when match_results was created without a public_status column', async () => {
    await withRepository(async ({ db }) => {
      await db.exec('DROP TABLE IF EXISTS match_results');
      await db.exec(`
        CREATE TABLE match_results (
          match_id INTEGER PRIMARY KEY,
          home_score INTEGER,
          away_score INTEGER,
          minute INTEGER,
          status TEXT NOT NULL,
          is_final INTEGER NOT NULL DEFAULT 0,
          provisional_home_score INTEGER,
          provisional_away_score INTEGER,
          provisional_status TEXT,
          confirmed_home_score INTEGER,
          confirmed_away_score INTEGER,
          confirmed_at TEXT,
          confirmation_source TEXT,
          confirmation_confidence TEXT,
          needs_review_reason TEXT,
          provider TEXT,
          provider_fixture_id TEXT,
          raw_provider_status TEXT,
          last_checked_at TEXT,
          last_provider_check_at TEXT,
          next_check_at TEXT,
          next_confirmation_check_at TEXT,
          provider_results_json TEXT,
          updated_at TEXT NOT NULL,
          points_recalculated_at TEXT
        )
      `);
      await db.run(`INSERT INTO teams (id, name, name_et, code, flag, group_id) VALUES (?, ?, ?, ?, ?, ?)`, ['mex', 'Mexico', 'Mehhiko', 'MEX', '', 'A']);
      await db.run(`INSERT INTO teams (id, name, name_et, code, flag, group_id) VALUES (?, ?, ?, ?, ?, ?)`, ['rsa', 'South Africa', 'Lõuna-Aafrika Vabariik', 'RSA', '', 'A']);
      await db.run(`
        INSERT INTO matches (id, stage, group_id, kickoff_at, home_team_id, away_team_id, home_slot, away_slot)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [1, 'GROUP', 'A', '2026-06-11T19:00:00.000Z', 'mex', 'rsa', 'Mexico', 'South Africa']);
      await db.run(`
        INSERT INTO match_results (
          match_id, home_score, away_score, status, is_final,
          confirmed_home_score, confirmed_away_score, confirmed_at,
          confirmation_source, confirmation_confidence, provider, raw_provider_status,
          last_checked_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [1, 2, 0, 'FINISHED', 1, 2, 0, '2026-06-11T21:15:00.000Z', 'provider', 'provider-repeat', 'mock-result-provider', 'finished', '2026-06-11T21:15:00.000Z', '2026-06-11T21:15:00.000Z']);

      const compatDb: QueryableDatabase = {
        ...db,
        async exec(sql: string) {
          if (/ALTER TABLE match_results ADD COLUMN public_status/i.test(sql)) return;
          await db.exec(sql);
        }
      };

      const snapshot = await getPublicTournamentSnapshot(compatDb);
      const columns = await db.all('PRAGMA table_info(match_results)');

      assert.equal(columns.some((row) => row.name === 'public_status'), false);
      assert.equal(snapshot.completedMatchesCount, 1);
      assert.equal(snapshot.latestResults.length, 1);
      assert.equal(snapshot.latestResults[0]?.homeTeam, 'Mexico');
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

  it('leaderboard API response is zeroed before persisted result scoring exists', async () => {
    await withRepository(async ({ repository }) => {
      const response = await getCurrentLeaderboard(repository);
      assert.equal(response.mode, 'pre-results');
      assert.equal(response.entries.length, 109);
      assert.equal(response.entries.every((entry) => entry.points === 0), true);
      assert.equal(response.entries.every((entry) => entry.exactScores === 0), true);
      assert.equal(response.entries.every((entry) => entry.correctResults === 0), true);
      assert.equal(response.entries.every((entry) => entry.hitRate === 0), true);
    });
  });

  it('keeps downward movement visible across repeated public leaderboard reads', async () => {
    const startingRows = predictionRepository.getLeaderboard().map((entry) => ({
      ...entry,
      rank: 1,
      points: 0,
      exactScores: 0,
      correctResults: 0,
      hitRate: 0,
      matchesScored: 0,
      matchPoints: 0,
      groupBonusPoints: 0,
      playoffBonusPoints: 0,
      topScorerBonusPoints: 0,
      totalPoints: 0,
      previousRank: 1,
      lastUpdatedAt: '2026-06-15T18:00:00.000Z'
    }));

    let persisted = startingRows;
    const fakeRepository = {
      async getLeaderboard() {
        return persisted;
      },
      async replaceLeaderboard(entries: typeof startingRows) {
        persisted = entries;
      },
      async getLeaderboardMetadata() {
        return {
          lastRebuildAt: '2026-06-15T18:00:00.000Z',
          playersProcessed: startingRows.length,
          matchesProcessed: 1,
          changedEntries: startingRows.length,
          warnings: []
        };
      },
      async getFinalizedResults() {
        return [{
          matchId: 1,
          status: 'FINISHED',
          homeScore: 2,
          awayScore: 0,
          isFinal: true,
          lastCheckedAt: '2026-06-15T18:00:00.000Z',
          provider: 'mock-result-provider'
        }];
      }
    };

    const first = await getCurrentLeaderboard(fakeRepository as never);
    const firstDownward = first.entries.find((entry) => entry.previousRank !== undefined && entry.previousRank < entry.rank);

    const second = await getCurrentLeaderboard(fakeRepository as never);

    assert.equal(first.entries.length, 109);
    assert.ok(firstDownward);
    assert.equal(second.entries.length, 109);
    assert.equal(second.entries[0]?.playerId, first.entries[0]?.playerId);
  });
});

function leaderboardEntry(playerId: string, rank: number, points: number) {
  return {
    playerId,
    rank,
    points,
    exactScores: points >= 6 ? 1 : 0,
    correctResults: points > 0 ? 1 : 0,
    hitRate: points > 0 ? 1 : 0,
    matchesScored: 1,
    matchPoints: points,
    groupBonusPoints: 0,
    playoffBonusPoints: 0,
    topScorerBonusPoints: 0,
    totalPoints: points,
    lastUpdatedAt: '2026-06-15T18:00:00.000Z'
  };
}

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
