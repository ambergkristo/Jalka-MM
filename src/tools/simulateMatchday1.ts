import { db } from '../server/db.js';
import { runMatchday1DisagreementSimulation, runMatchday1Simulation } from '../server/results/matchdaySimulation.js';

const scenario = process.argv.includes('--scenario=disagreement') ? 'disagreement' : 'matchday1';

if (scenario === 'disagreement') {
  const report = await runMatchday1DisagreementSimulation(db);
  console.log(JSON.stringify({
    status: 'ok',
    scenario,
    needsReview: report.needsReviewCount,
    leaderboardRows: report.leaderboardRows,
    run: {
      checkedMatches: report.disagreementRun.checkedMatches,
      needsReview: report.disagreementRun.needsReview,
      leaderboardRebuilt: report.disagreementRun.leaderboardRebuilt,
      warnings: report.disagreementRun.warnings
    }
  }, null, 2));
} else {
  const report = await runMatchday1Simulation(db);
  console.log(JSON.stringify({
    status: 'ok',
    scenario,
    provisionalRun: {
      checkedMatches: report.provisionalRun.checkedMatches,
      confirmationPending: report.provisionalRun.confirmationPending,
      finalizedMatches: report.provisionalRun.finalizedMatches,
      leaderboardRebuilt: report.provisionalRun.leaderboardRebuilt
    },
    confirmingRun: {
      checkedMatches: report.confirmingRun.checkedMatches,
      confirmationPending: report.confirmingRun.confirmationPending,
      finalizedMatches: report.confirmingRun.finalizedMatches,
      leaderboardRebuilt: report.confirmingRun.leaderboardRebuilt,
      playersProcessed: report.confirmingRun.playersProcessed
    },
    confirmedResultsCount: report.confirmedResultsCount,
    latestResultsCount: report.latestResultsCount,
    leaderboardRows: report.leaderboardRows,
    topScorersCount: report.topScorersCount
  }, null, 2));
}

await db.close();
