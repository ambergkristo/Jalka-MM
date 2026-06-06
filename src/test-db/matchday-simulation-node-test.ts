import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { createDatabase, type QueryableDatabase } from '../server/databaseAdapter.js';
import { DatabaseResultRepository } from '../server/results/databaseResultRepository.js';
import { getCurrentLeaderboard } from '../server/results/resultAgentRuntime.js';
import { resetSimulationState, runMatchday1DisagreementSimulation, runMatchday1Simulation, simulatedTopScorers, MATCHDAY1_CONFIRM_AT, MATCHDAY1_PROVISIONAL_AT } from '../server/results/matchdaySimulation.js';
import { getPublicTournamentSnapshot } from '../server/results/publicTournamentSnapshot.js';
import { runResultUpdateCycle } from '../server/results/resultAgent.js';
import { SimulationResultProvider } from '../server/results/simulationResultProvider.js';

describe('matchday 1 simulation with persistent storage', () => {
  it('keeps first final observations provisional and hides latest public results', async () => {
    await withSimulationDb(async (db) => {
      await resetSimulationState(db, { seedSchedule: true });
      const repository = new DatabaseResultRepository(db);
      const summary = await runResultUpdateCycle({
        repository,
        leaderboardRepository: repository,
        provider: new SimulationResultProvider(),
        now: MATCHDAY1_PROVISIONAL_AT,
        confirmationDelayMinutes: 10
      });

      assert.equal(summary.checkedMatches, 3);
      assert.equal(summary.confirmationPending, 3);
      assert.equal(summary.finalizedMatches, 0);
      assert.equal(summary.leaderboardRebuilt, false);
      assert.deepEqual(await repository.getLeaderboard(), []);
      const snapshot = await getPublicTournamentSnapshot(db);
      const leaderboard = await getCurrentLeaderboard(repository);
      assert.deepEqual(snapshot.latestResults, []);
      assert.equal(snapshot.upcomingMatches.length > 0, true);
      assert.equal(snapshot.upcomingMatches[0]?.homeTeam, 'Mexico');
      assert.match(snapshot.upcomingMatches[0]?.kickoffTime ?? '', /^\d{2}\.\d{2} • \d{2}:\d{2}$/);
      assert.equal(leaderboard.mode, 'pre-results');
      assert.equal(leaderboard.entries.every((entry) => entry.points === 0 && entry.exactScores === 0 && entry.correctResults === 0 && entry.hitRate === 0), true);
    });
  });

  it('confirms repeated final observations, rebuilds leaderboard, and updates public aggregates', async () => {
    await withSimulationDb(async (db) => {
      const report = await runMatchday1Simulation(db);
      const repository = new DatabaseResultRepository(db);
      const snapshot = await getPublicTournamentSnapshot(db);

      assert.equal(report.provisionalRun.confirmationPending, 3);
      assert.equal(report.provisionalRun.leaderboardRebuilt, false);
      assert.equal(report.confirmingRun.finalizedMatches, 3);
      assert.equal(report.confirmingRun.leaderboardRebuilt, true);
      assert.equal(report.confirmedResultsCount, 3);
      assert.equal(report.leaderboardRows, 24);
      assert.equal((await repository.getLeaderboard()).length, 24);
      const leaderboard = await getCurrentLeaderboard(repository);
      assert.equal(leaderboard.mode, 'persisted');
      assert.equal(leaderboard.entries.some((entry) => entry.points > 0), true);
      assert.equal(snapshot.latestResults.length, 3);
      assert.equal(snapshot.upcomingMatches.some((match) => match.id === '1'), false);
      assert.deepEqual(snapshot.latestResults[0], {
        id: '3',
        homeTeam: 'Canada',
        awayTeam: 'Bosnia and Herzegovina',
        homeScore: 2,
        awayScore: 0,
        stage: 'Alagrupp B',
        winner: 'Canada',
        finishedAt: snapshot.latestResults[0]?.finishedAt
      });
      assert.equal(snapshot.groupStandings.find((group) => group.group === 'A')?.teams[0]?.team, 'Mexico');
      assert.equal(snapshot.groupStandings.find((group) => group.group === 'A')?.teams[0]?.points, 3);
      assert.equal(snapshot.groupStandings.find((group) => group.group === 'B')?.teams[0]?.team, 'Canada');
      assert.equal(snapshot.groupStandings.find((group) => group.group === 'B')?.teams[0]?.points, 3);
      assert.equal(snapshot.topScorers.length, simulatedTopScorers().length);
      assert.equal(Number((await db.one('SELECT COUNT(*) AS count FROM leaderboard_entries'))?.count), 24);

      const repeated = await runResultUpdateCycle({
        repository,
        leaderboardRepository: repository,
        provider: new SimulationResultProvider(),
        now: new Date(MATCHDAY1_CONFIRM_AT.getTime() + 60_000),
        confirmationDelayMinutes: 10
      });
      assert.equal(repeated.checkedMatches, 0);
      assert.equal((await repository.getLeaderboard()).length, 24);
    });
  });

  it('marks provider disagreement as needs review and does not rebuild leaderboard', async () => {
    await withSimulationDb(async (db) => {
      const report = await runMatchday1DisagreementSimulation(db);

      assert.equal(report.disagreementRun.checkedMatches, 3);
      assert.equal(report.disagreementRun.needsReview, 3);
      assert.equal(report.disagreementRun.leaderboardRebuilt, false);
      assert.equal(report.needsReviewCount, 3);
      assert.equal(report.leaderboardRows, 0);
    });
  });

  it('reset clears simulation-created public state', async () => {
    await withSimulationDb(async (db) => {
      await runMatchday1Simulation(db);
      await resetSimulationState(db);
      const snapshot = await getPublicTournamentSnapshot(db);

      assert.deepEqual(snapshot.latestResults, []);
      assert.deepEqual(snapshot.topScorers, []);
      assert.equal(snapshot.upcomingMatches.length > 0, true);
      assert.equal(Number((await db.one('SELECT COUNT(*) AS count FROM leaderboard_entries'))?.count), 0);
      assert.equal(Number((await db.one('SELECT COUNT(*) AS count FROM match_results'))?.count), 0);
      const leaderboard = await getCurrentLeaderboard(new DatabaseResultRepository(db));
      assert.equal(leaderboard.mode, 'pre-results');
      assert.equal(leaderboard.entries.every((entry) => entry.points === 0), true);
    });
  });
});

async function withSimulationDb(callback: (db: QueryableDatabase) => Promise<void>): Promise<void> {
  const db = createDatabase({
    appEnv: 'local',
    databaseMode: 'sqlite',
    sqlitePath: join(tmpdir(), `jalka-mm-matchday-simulation-${randomUUID()}.sqlite`),
    publicAppBaseUrl: 'http://localhost:5174',
    tournamentDataMode: 'partial_official',
    allowDestructiveCommands: true,
    allowUnsafeProductionSqlite: false
  });
  try {
    await callback(db);
  } finally {
    await db.close();
  }
}
