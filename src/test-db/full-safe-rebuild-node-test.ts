import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runFullSafeRebuildSequence, type FullSafeRebuildStepDefinition } from '../server/results/publicStateHealth.js';

describe('full safe rebuild sequence', () => {
  it('executes steps in the configured order and merges the summary', async () => {
    const calls: string[] = [];
    const steps: FullSafeRebuildStepDefinition[] = [
      step('result-agent-catch-up', 'Run result-agent catch-up', calls, { scoresUpdated: 2 }),
      step('resync-scorers-from-confirmed-results', 'Re-sync scorers from confirmed provider results', calls, { scorerFactsInserted: 3 }),
      step('rebuild-group-standings', 'Rebuild group standings', calls, { groupStandingsRebuilt: true }),
      step('rebuild-leaderboard', 'Rebuild leaderboard', calls, { leaderboardRebuilt: true }),
      step('rebuild-top-scorers', 'Rebuild top scorer standings', calls, { topScorerStandingsRebuilt: true }),
      step('rebuild-public-dashboard', 'Rebuild public dashboard state', calls, { publicDashboardRebuilt: true })
    ];

    const result = await runFullSafeRebuildSequence({
      now: new Date('2026-06-22T10:00:00.000Z'),
      steps
    });

    assert.equal(result.status, 'ok');
    assert.deepEqual(calls, steps.map((item) => item.step));
    assert.deepEqual(result.stepsCompleted, steps.map((item) => item.label));
    assert.equal(result.summary.scoresUpdated, 2);
    assert.equal(result.summary.scorerFactsInserted, 3);
    assert.equal(result.summary.groupStandingsRebuilt, true);
    assert.equal(result.summary.leaderboardRebuilt, true);
    assert.equal(result.summary.topScorerStandingsRebuilt, true);
    assert.equal(result.summary.publicDashboardRebuilt, true);
  });

  it('stops at the failed step and does not run later steps', async () => {
    const calls: string[] = [];
    let laterStepRan = false;
    const steps: FullSafeRebuildStepDefinition[] = [
      step('result-agent-catch-up', 'Run result-agent catch-up', calls, { scoresUpdated: 1 }),
      {
        step: 'resync-scorers-from-confirmed-results',
        label: 'Re-sync scorers from confirmed provider results',
        async run() {
          calls.push('resync-scorers-from-confirmed-results');
          throw new Error('provider scorer facts missing');
        }
      },
      {
        step: 'rebuild-group-standings',
        label: 'Rebuild group standings',
        async run() {
          laterStepRan = true;
          return { message: 'unexpected' };
        }
      }
    ];

    const result = await runFullSafeRebuildSequence({
      now: new Date('2026-06-22T10:00:00.000Z'),
      steps
    });

    assert.equal(result.status, 'failed');
    assert.deepEqual(calls, ['result-agent-catch-up', 'resync-scorers-from-confirmed-results']);
    assert.equal(laterStepRan, false);
    assert.equal(result.failedStep?.step, 'resync-scorers-from-confirmed-results');
    assert.equal(result.failedStep?.message, 'provider scorer facts missing');
    assert.equal(result.summary.scoresUpdated, 1);
  });
});

function step(
  step: FullSafeRebuildStepDefinition['step'],
  label: string,
  calls: string[],
  summary: NonNullable<Awaited<ReturnType<FullSafeRebuildStepDefinition['run']>>['summary']>
): FullSafeRebuildStepDefinition {
  return {
    step,
    label,
    async run() {
      calls.push(step);
      return { message: `${label} ok`, summary };
    }
  };
}
