import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { join } from 'node:path';

process.env.WORLDCUP_DB_PATH = join(process.cwd(), 'data', 'test-worldcup2026.sqlite');

const { breakdownFor, createPlayer, getLeaderboard, getState, recalculateScores, resetDevData, resetForTests, saveBonusPrediction, saveBonusResults, savePredictions, saveResult, seedDemo, seedTournamentData, setDeadline, setLock, updatePlayerStatus } = await import('../server/db.js');

describe('stored scoring path', () => {
  beforeEach(async () => {
    await seedDemo({ allowDestructive: true, confirmation: 'DELETE_LOCAL_DATA' });
    await resetForTests();
    await seedDemo({ allowDestructive: true, confirmation: 'DELETE_LOCAL_DATA' });
  });

  it('rejects prediction updates when manually locked', async () => {
    const player = await createPlayer('Locked Player', 'FRIENDS2026');
    await setLock('admin', true);
    await assert.rejects(() => savePredictions(player.id, [{ matchId: 1, homeGoals: 1, awayGoals: 0 }]), /Predictions are locked/);
  });

  it('rejects prediction updates after deadline', async () => {
    const player = await createPlayer('Late Player', 'FRIENDS2026');
    await setDeadline('admin', '2020-01-01T00:00:00.000Z');
    await assert.rejects(() => savePredictions(player.id, [{ matchId: 1, homeGoals: 1, awayGoals: 0 }]), /deadline/);
  });

  it('generates match score explanations from stored predictions and results', async () => {
    const player = await createPlayer('Exact Player', 'FRIENDS2026');
    await savePredictions(player.id, [{ matchId: 1, homeGoals: 2, awayGoals: 1 }]);
    await saveResult('admin', { matchId: 1, homeGoals: 2, awayGoals: 1 });
    assert.deepEqual(
      (await breakdownFor(player.id)).some((row) => row.item_type === 'match' && row.item_id === '1' && row.points === 6 && row.explanation === '6p: exact score correct'),
      true
    );
  });

  it('scores bonus predictions through stored data including split top scorer points', async () => {
    const player = await createPlayer('Bonus Player', 'FRIENDS2026');
    const groups = [{ groupId: 'A', winnerTeamId: 'T01', secondTeamId: 'T02', qualifierTeamIds: ['T01', 'T02'] }];
    const knockout = { r16TeamIds: ['T01'], qfTeamIds: ['T01'], sfTeamIds: ['T01'], finalTeamIds: ['T01'], thirdPlaceWinnerTeamId: 'T02', championTeamId: 'T01', topScorer: 'Player A' };
    await saveBonusPrediction(player.id, groups, knockout);
    await saveBonusResults('admin', groups, { ...knockout, topScorers: ['Player A', 'Player B'] });
    const breakdown = await breakdownFor(player.id);
    assert.equal(breakdown.some((row) => row.item_type === 'bonus' && row.item_id === 'winner' && row.points === 100), true);
    assert.equal(breakdown.some((row) => row.item_type === 'bonus' && row.item_id === 'top-scorer:Player A' && row.points === 25), true);
  });

  it('keeps leaderboard tie-break by earlier submission time', async () => {
    const early = await createPlayer('Early', 'FRIENDS2026');
    const late = await createPlayer('Late', 'FRIENDS2026');
    await updatePlayerStatus('admin-admin', 'ADMIN2026', early.id, 'approved');
    await updatePlayerStatus('admin-admin', 'ADMIN2026', late.id, 'approved');
    await savePredictions(early.id, [{ matchId: 1, homeGoals: 1, awayGoals: 0 }]);
    await savePredictions(late.id, [{ matchId: 1, homeGoals: 1, awayGoals: 0 }]);
    await saveResult('admin', { matchId: 1, homeGoals: 2, awayGoals: 0 });
    const leaderboard = await getLeaderboard();
    assert.equal(leaderboard.findIndex((row) => row.playerId === early.id) < leaderboard.findIndex((row) => row.playerId === late.id), true);
  });

  it('keeps recalculation idempotent after bonus result changes', async () => {
    const player = await createPlayer('Stable Bonus', 'FRIENDS2026');
    const groups = [{ groupId: 'A', winnerTeamId: 'T01', secondTeamId: 'T02', qualifierTeamIds: ['T01', 'T02'] }];
    const knockout = { r16TeamIds: ['T01'], qfTeamIds: [], sfTeamIds: [], finalTeamIds: [], thirdPlaceWinnerTeamId: 'T02', championTeamId: 'T01', topScorer: 'Player A' };
    await saveBonusPrediction(player.id, groups, knockout);
    await saveBonusResults('admin', groups, { ...knockout, topScorers: ['Player A'] });
    assert.equal(JSON.stringify(await recalculateScores()), JSON.stringify(await recalculateScores()));
  });

  it('updates tournament data without deleting players or predictions', async () => {
    const player = await createPlayer('Persistent Player', 'FRIENDS2026');
    await updatePlayerStatus('admin-admin', 'ADMIN2026', player.id, 'approved');
    await savePredictions(player.id, [{ matchId: 1, homeGoals: 2, awayGoals: 0 }]);
    const knockout = { r16TeamIds: ['A1'], qfTeamIds: ['A1'], sfTeamIds: ['A1'], finalTeamIds: ['A1'], thirdPlaceWinnerTeamId: 'A2', championTeamId: 'A1', topScorer: 'Player A' };
    await saveBonusPrediction(player.id, [{ groupId: 'A', winnerTeamId: 'A1', secondTeamId: 'A2', qualifierTeamIds: ['A1', 'A2'] }], knockout);

    await seedTournamentData();

    assert.equal((await getLeaderboard()).some((row) => row.playerId === player.id), true);
    await saveResult('admin', { matchId: 1, homeGoals: 2, awayGoals: 0 });
    assert.equal((await breakdownFor(player.id)).some((row) => row.item_type === 'match' && row.item_id === '1'), true);
  });

  it('refuses destructive reset unless explicitly allowed', async () => {
    await assert.rejects(() => resetDevData(), /Destructive reset refused/);
  });

  it('refuses destructive reset in production mode', async () => {
    const previous = process.env.APP_ENV;
    const previousSecret = process.env.ADMIN_SECRET;
    try {
      process.env.APP_ENV = 'production';
      process.env.ADMIN_SECRET = 'production-secret';
      await assert.rejects(() => resetDevData({ allowDestructive: true, confirmation: 'DELETE_LOCAL_DATA' }), /production/i);
    } finally {
      if (previous === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = previous;
      if (previousSecret === undefined) delete process.env.ADMIN_SECRET; else process.env.ADMIN_SECRET = previousSecret;
    }
  });

  it('creates new players as pending and excludes them from official leaderboard', async () => {
    const player = await createPlayer('Pending Player', 'FRIENDS2026');
    assert.equal(player.status, 'pending');
    await savePredictions(player.id, [{ matchId: 1, homeGoals: 1, awayGoals: 0 }]);
    await saveResult('admin', { matchId: 1, homeGoals: 1, awayGoals: 0 });
    assert.equal((await getLeaderboard()).some((row) => row.playerId === player.id), false);
  });

  it('allows pending players to save predictions and keeps submission time through approval', async () => {
    const player = await createPlayer('Approve Later', 'FRIENDS2026');
    await savePredictions(player.id, [{ matchId: 1, homeGoals: 1, awayGoals: 0 }]);
    const before = await getState(player.id);
    const submittedAt = String(before.currentPlayer ? before.predictions[0].updated_at : '');
    await updatePlayerStatus('admin-admin', 'ADMIN2026', player.id, 'approved');
    assert.equal((await getLeaderboard()).some((row) => row.playerId === player.id), true);
    assert.equal(String((await getState(player.id)).predictions[0].updated_at), submittedAt);
  });

  it('rejects non-admin approval attempts and excludes disabled players', async () => {
    const player = await createPlayer('Needs Admin', 'FRIENDS2026');
    await assert.rejects(() => updatePlayerStatus(player.id, 'ADMIN2026', player.id, 'approved'), /Admin access required/);
    await updatePlayerStatus('admin-admin', 'ADMIN2026', player.id, 'approved');
    assert.equal((await getLeaderboard()).some((row) => row.playerId === player.id), true);
    await updatePlayerStatus('admin-admin', 'ADMIN2026', player.id, 'disabled');
    assert.equal((await getLeaderboard()).some((row) => row.playerId === player.id), false);
  });

  it('keeps player approval statuses during tournament data updates', async () => {
    const player = await createPlayer('Status Stable', 'FRIENDS2026');
    await updatePlayerStatus('admin-admin', 'ADMIN2026', player.id, 'approved');
    await seedTournamentData();
    assert.equal((await getState(player.id)).currentPlayer?.status, 'approved');
  });
});
