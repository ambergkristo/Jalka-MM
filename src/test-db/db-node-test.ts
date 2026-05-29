import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { join } from 'node:path';

process.env.WORLDCUP_DB_PATH = join(process.cwd(), 'data', 'test-worldcup2026.sqlite');

const { breakdownFor, createPlayer, getLeaderboard, recalculateScores, resetForTests, saveBonusPrediction, saveBonusResults, savePredictions, saveResult, seedDemo, setDeadline, setLock } = await import('../server/db.js');

describe('stored scoring path', () => {
  beforeEach(() => {
    seedDemo();
    resetForTests();
    seedDemo();
  });

  it('rejects prediction updates when manually locked', () => {
    const player = createPlayer('Locked Player', 'FRIENDS2026');
    setLock('admin', true);
    assert.throws(() => savePredictions(player.id, [{ matchId: 1, homeGoals: 1, awayGoals: 0 }]), /Predictions are locked/);
  });

  it('rejects prediction updates after deadline', () => {
    const player = createPlayer('Late Player', 'FRIENDS2026');
    setDeadline('admin', '2020-01-01T00:00:00.000Z');
    assert.throws(() => savePredictions(player.id, [{ matchId: 1, homeGoals: 1, awayGoals: 0 }]), /deadline/);
  });

  it('generates match score explanations from stored predictions and results', () => {
    const player = createPlayer('Exact Player', 'FRIENDS2026');
    savePredictions(player.id, [{ matchId: 1, homeGoals: 2, awayGoals: 1 }]);
    saveResult('admin', { matchId: 1, homeGoals: 2, awayGoals: 1 });
    assert.deepEqual(
      breakdownFor(player.id).some((row) => row.item_type === 'match' && row.item_id === '1' && row.points === 6 && row.explanation === '6p: exact score correct'),
      true
    );
  });

  it('scores bonus predictions through stored data including split top scorer points', () => {
    const player = createPlayer('Bonus Player', 'FRIENDS2026');
    const groups = [{ groupId: 'A', winnerTeamId: 'T01', secondTeamId: 'T02', qualifierTeamIds: ['T01', 'T02'] }];
    const knockout = { r16TeamIds: ['T01'], qfTeamIds: ['T01'], sfTeamIds: ['T01'], finalTeamIds: ['T01'], thirdPlaceWinnerTeamId: 'T02', championTeamId: 'T01', topScorer: 'Player A' };
    saveBonusPrediction(player.id, groups, knockout);
    saveBonusResults('admin', groups, { ...knockout, topScorers: ['Player A', 'Player B'] });
    const breakdown = breakdownFor(player.id);
    assert.equal(breakdown.some((row) => row.item_type === 'bonus' && row.item_id === 'winner' && row.points === 100), true);
    assert.equal(breakdown.some((row) => row.item_type === 'bonus' && row.item_id === 'top-scorer:Player A' && row.points === 25), true);
  });

  it('keeps leaderboard tie-break by earlier submission time', () => {
    const early = createPlayer('Early', 'FRIENDS2026');
    const late = createPlayer('Late', 'FRIENDS2026');
    savePredictions(early.id, [{ matchId: 1, homeGoals: 1, awayGoals: 0 }]);
    savePredictions(late.id, [{ matchId: 1, homeGoals: 1, awayGoals: 0 }]);
    saveResult('admin', { matchId: 1, homeGoals: 2, awayGoals: 0 });
    const leaderboard = getLeaderboard();
    assert.equal(leaderboard.findIndex((row) => row.playerId === early.id) < leaderboard.findIndex((row) => row.playerId === late.id), true);
  });

  it('keeps recalculation idempotent after bonus result changes', () => {
    const player = createPlayer('Stable Bonus', 'FRIENDS2026');
    const groups = [{ groupId: 'A', winnerTeamId: 'T01', secondTeamId: 'T02', qualifierTeamIds: ['T01', 'T02'] }];
    const knockout = { r16TeamIds: ['T01'], qfTeamIds: [], sfTeamIds: [], finalTeamIds: [], thirdPlaceWinnerTeamId: 'T02', championTeamId: 'T01', topScorer: 'Player A' };
    saveBonusPrediction(player.id, groups, knockout);
    saveBonusResults('admin', groups, { ...knockout, topScorers: ['Player A'] });
    assert.equal(JSON.stringify(recalculateScores()), JSON.stringify(recalculateScores()));
  });
});
