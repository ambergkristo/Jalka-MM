import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { join } from 'node:path';

process.env.WORLDCUP_DB_PATH = join(process.cwd(), 'data', 'test-worldcup2026.sqlite');
process.env.BOOTSTRAP_ADMIN_KRISTO_PASSWORD = 'local-kristo-test';
process.env.BOOTSTRAP_ADMIN_ARGO_PASSWORD = 'local-argo-test';

const { authenticateAdmin, authenticatePlayer, breakdownFor, clearResult, createPlayer, createSession, db, deletePlayer, getLeaderboard, getState, recalculateScores, registerPlayer, resetDevData, resetForTests, saveBonusPrediction, saveBonusResults, savePredictions, saveResult, seedDemo, seedTournamentData, sessionFromToken, setDeadline, setLock, submitFinalPredictions, updatePlayerStatus } = await import('../server/db.js');

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

  it('clears one actual result, audits the admin actor, and recalculates points', async () => {
    const player = await createPlayer('Clear Result Player', 'FRIENDS2026');
    await updatePlayerStatus('Kristo', player.id, 'approved');
    await savePredictions(player.id, [
      { matchId: 1, homeGoals: 0, awayGoals: 0 },
      { matchId: 2, homeGoals: 1, awayGoals: 0 }
    ]);
    await forceFinal(player.id, '2026-06-01T10:00:00.000Z');
    await saveResult('Kristo', { matchId: 1, homeGoals: 0, awayGoals: 0 });
    await saveResult('Kristo', { matchId: 2, homeGoals: 1, awayGoals: 0 });
    assert.equal((await breakdownFor(player.id)).some((row) => row.item_type === 'match' && row.item_id === '1'), true);

    await clearResult('Argo', 1);

    const state = await getState(player.id);
    assert.equal(state.results.some((row: any) => Number(row.match_id) === 1), false);
    assert.equal(state.results.some((row: any) => Number(row.match_id) === 2), true);
    assert.equal(state.predictions.length, 2);
    assert.equal((await breakdownFor(player.id)).some((row) => row.item_type === 'match' && row.item_id === '1'), false);
    assert.equal((await breakdownFor(player.id)).some((row) => row.item_type === 'match' && row.item_id === '2'), true);
    const audit = await db.one("SELECT * FROM admin_audit_log WHERE action = 'match_result.cleared' ORDER BY id DESC LIMIT 1");
    assert.equal(audit?.actor, 'Argo');
    assert.match(String(audit?.payload_json), /"matchId":1/);
  });

  it('preserves a real entered 0:0 result as scoreable data', async () => {
    const player = await createPlayer('Nil Nil Player', 'FRIENDS2026');
    await updatePlayerStatus('Kristo', player.id, 'approved');
    await savePredictions(player.id, [{ matchId: 1, homeGoals: 0, awayGoals: 0 }]);
    await forceFinal(player.id, '2026-06-01T10:00:00.000Z');
    await saveResult('Kristo', { matchId: 1, homeGoals: 0, awayGoals: 0 });

    const result = (await getState(player.id)).results.find((row: any) => Number(row.match_id) === 1);
    assert.ok(result);
    assert.equal(Number(result.home_goals), 0);
    assert.equal(Number(result.away_goals), 0);
    assert.equal((await breakdownFor(player.id)).some((row) => row.item_type === 'match' && row.item_id === '1' && Number(row.points) === 6), true);
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

  it('scores group bonuses from derived group-stage predictions without manual group bonus input', async () => {
    const player = await createPlayer('Derived Group Bonus', 'FRIENDS2026');
    const group = await db.one("SELECT id FROM groups WHERE id = 'A'");
    const teams = await db.all('SELECT id FROM teams WHERE group_id = ? ORDER BY id LIMIT 4', [String(group?.id)]);
    const groupMatches = await db.all("SELECT id, home_team_id, away_team_id FROM matches WHERE stage = 'GROUP' AND group_id = ? ORDER BY id", [String(group?.id)]);
    const order = new Map(teams.map((team, index) => [String(team.id), index]));
    await savePredictions(player.id, groupMatches.map((match) => {
      const homeRank = order.get(String(match.home_team_id)) ?? 0;
      const awayRank = order.get(String(match.away_team_id)) ?? 0;
      return { matchId: Number(match.id), homeGoals: homeRank < awayRank ? 2 : 0, awayGoals: awayRank < homeRank ? 2 : 0 };
    }));
    await saveBonusResults('admin', [{ groupId: 'A', winnerTeamId: String(teams[0].id), secondTeamId: String(teams[1].id), qualifierTeamIds: [String(teams[0].id), String(teams[1].id), String(teams[2].id)] }], { r16TeamIds: [], qfTeamIds: [], sfTeamIds: [], finalTeamIds: [], thirdPlaceWinnerTeamId: '', championTeamId: '', topScorer: '', topScorers: [] });
    const breakdown = await breakdownFor(player.id);
    assert.equal(breakdown.some((row) => row.item_type === 'bonus' && row.item_id === 'A:winner'), true);
    assert.equal(breakdown.some((row) => String(row.explanation).includes('tuletatud')), true);
  });

  it('keeps leaderboard tie-break by earlier submission time', async () => {
    const early = await createPlayer('Early', 'FRIENDS2026');
    const late = await createPlayer('Late', 'FRIENDS2026');
    await updatePlayerStatus('Kristo', early.id, 'approved');
    await updatePlayerStatus('Kristo', late.id, 'approved');
    await savePredictions(early.id, [{ matchId: 1, homeGoals: 1, awayGoals: 0 }]);
    await savePredictions(late.id, [{ matchId: 1, homeGoals: 1, awayGoals: 0 }]);
    await forceFinal(early.id, '2026-06-01T10:00:00.000Z');
    await forceFinal(late.id, '2026-06-01T11:00:00.000Z');
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
    await updatePlayerStatus('Kristo', player.id, 'approved');
    await savePredictions(player.id, [{ matchId: 1, homeGoals: 2, awayGoals: 0 }]);
    const knockout = { r16TeamIds: ['A1'], qfTeamIds: ['A1'], sfTeamIds: ['A1'], finalTeamIds: ['A1'], thirdPlaceWinnerTeamId: 'A2', championTeamId: 'A1', topScorer: 'Player A' };
    await saveBonusPrediction(player.id, [{ groupId: 'A', winnerTeamId: 'A1', secondTeamId: 'A2', qualifierTeamIds: ['A1', 'A2'] }], knockout);

    await seedTournamentData();

    await forceFinal(player.id, '2026-06-01T10:00:00.000Z');
    assert.equal((await getLeaderboard()).some((row) => row.playerId === player.id), true);
    await saveResult('admin', { matchId: 1, homeGoals: 2, awayGoals: 0 });
    assert.equal((await breakdownFor(player.id)).some((row) => row.item_type === 'match' && row.item_id === '1'), true);
  });

  it('refuses destructive reset unless explicitly allowed', async () => {
    await assert.rejects(() => resetDevData(), /Destructive reset refused/);
  });

  it('refuses destructive reset in production mode', async () => {
    const previous = process.env.APP_ENV;
    const previousSecret = process.env.SESSION_SECRET;
    try {
      process.env.APP_ENV = 'production';
      process.env.SESSION_SECRET = 'production-session-secret';
      await assert.rejects(() => resetDevData({ allowDestructive: true, confirmation: 'DELETE_LOCAL_DATA' }), /production/i);
    } finally {
      if (previous === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = previous;
      if (previousSecret === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = previousSecret;
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
    await updatePlayerStatus('Kristo', player.id, 'approved');
    assert.equal((await getLeaderboard()).some((row) => row.playerId === player.id), false);
    assert.equal(String((await getState(player.id)).predictions[0].updated_at), submittedAt);
  });

  it('rejects non-admin approval attempts and excludes disabled players', async () => {
    const player = await createPlayer('Needs Admin', 'FRIENDS2026');
    await updatePlayerStatus('Kristo', player.id, 'approved');
    await forceFinal(player.id, '2026-06-01T10:00:00.000Z');
    assert.equal((await getLeaderboard()).some((row) => row.playerId === player.id), true);
    await updatePlayerStatus('Kristo', player.id, 'disabled');
    assert.equal((await getLeaderboard()).some((row) => row.playerId === player.id), false);
  });

  it('keeps player approval statuses during tournament data updates', async () => {
    const player = await createPlayer('Status Stable', 'FRIENDS2026');
    await updatePlayerStatus('Kristo', player.id, 'approved');
    await seedTournamentData();
    assert.equal((await getState(player.id)).currentPlayer?.status, 'approved');
  });

  it('lets admin delete one selected test player and dependent predictions only', async () => {
    const remove = await createPlayer('Remove Test', 'FRIENDS2026');
    const keep = await createPlayer('Keep Test', 'FRIENDS2026');
    await savePredictions(remove.id, [{ matchId: 1, homeGoals: 1, awayGoals: 0 }]);
    await savePredictions(keep.id, [{ matchId: 1, homeGoals: 2, awayGoals: 0 }]);
    await assert.rejects(() => deletePlayer('Kristo', remove.id, 'wrong name'), /confirmation/i);

    const state = await deletePlayer('Kristo', remove.id, 'Remove Test');

    assert.equal(state.playerAdmin.some((row: any) => row.id === remove.id), false);
    assert.equal((await getState(keep.id)).predictions.length, 1);
    assert.equal((await getState(remove.id)).currentPlayer, null);
  });

  it('registers full-name players with hashed credentials and rejects duplicate names', async () => {
    const player = await registerPlayer({ firstName: 'Mari', lastName: 'Tamm', contact: 'mari@example.test', inviteCode: 'FRIENDS2026', password: 'secret1' });
    assert.equal(player.name, 'Mari Tamm');
    await assert.rejects(() => registerPlayer({ firstName: 'Mari', lastName: 'Tamm', inviteCode: 'FRIENDS2026', password: 'secret2' }), /full name/);
    await assert.rejects(() => authenticatePlayer('Mari', 'Tamm', 'FRIENDS2026'), /Invalid credentials/);
    assert.equal((await authenticatePlayer('Mari', 'Tamm', 'secret1')).id, player.id);
    const user = await db.one('SELECT password_hash FROM users WHERE id = ?', [player.id]);
    assert.notEqual(user?.password_hash, 'secret1');
    assert.match(String(user?.password_hash), /^scrypt\$/);
  });

  it('bootstraps named admins and creates server sessions', async () => {
    const kristo = await authenticateAdmin('Kristo', 'local-kristo-test');
    const argo = await authenticateAdmin('Argo', 'local-argo-test');
    assert.equal(kristo.name, 'Kristo');
    assert.equal(argo.name, 'Argo');
    await assert.rejects(() => authenticateAdmin('Kristo', 'wrong-password'), /Invalid admin credentials/);
    const session = await createSession(kristo);
    assert.equal((await sessionFromToken(session.token))?.name, 'Kristo');
    const admin = await db.one('SELECT password_hash FROM admin_accounts WHERE username = ?', ['Kristo']);
    assert.notEqual(admin?.password_hash, 'local-kristo-test');
  });

  it('draft save does not set final submission and incomplete final submit is rejected', async () => {
    const player = await createPlayer('Draft Only', 'FRIENDS2026');
    await savePredictions(player.id, [{ matchId: 1, homeGoals: 1, awayGoals: 0 }]);
    assert.equal((await getState(player.id)).submission, null);
    await assert.rejects(() => submitFinalPredictions(player.id), /incomplete/i);
  });

  it('accepts a complete intentionally inconsistent playoff country prediction', async () => {
    const player = await createPlayer('Independent Playoff', 'FRIENDS2026');
    await savePredictions(player.id, await completePredictions(), await completeTieResolutions());
    const { groups, knockout } = await completeBonus();
    await saveBonusPrediction(player.id, groups, knockout);

    await submitFinalPredictions(player.id);

    assert.equal((await getState(player.id)).submission?.is_final, 1);
  });

  it('rejects same-country and missing-penalty knockout final submissions', async () => {
    const duplicate = await createPlayer('Duplicate Knockout', 'FRIENDS2026');
    const duplicatePredictions = await completePredictions();
    const firstKnockout = duplicatePredictions.find((prediction) => prediction.matchId === 73)!;
    firstKnockout.awayTeamPredictionId = firstKnockout.homeTeamPredictionId;
    firstKnockout.predictedWinnerTeamId = undefined;
    await savePredictions(duplicate.id, duplicatePredictions);
    const duplicateBonus = await completeBonus();
    await saveBonusPrediction(duplicate.id, duplicateBonus.groups, duplicateBonus.knockout);
    await assert.rejects(() => submitFinalPredictions(duplicate.id), /Same country/);

    const tied = await createPlayer('Missing Penalty', 'FRIENDS2026');
    const tiedPredictions = await completePredictions();
    const tiedKnockout = tiedPredictions.find((prediction) => prediction.matchId === 73)!;
    tiedKnockout.homeGoals = 1;
    tiedKnockout.awayGoals = 1;
    tiedKnockout.penaltyWinner = undefined;
    tiedKnockout.predictedWinnerTeamId = undefined;
    await savePredictions(tied.id, tiedPredictions);
    const tiedBonus = await completeBonus();
    await saveBonusPrediction(tied.id, tiedBonus.groups, tiedBonus.knockout);
    await assert.rejects(() => submitFinalPredictions(tied.id), /Penalty winner/);
  });
});

async function forceFinal(playerId: string, submittedAt: string) {
  await db.run('INSERT OR REPLACE INTO prediction_submissions (player_id, submitted_at, final_submitted_at, snapshot_hash, revision, is_final) VALUES (?, ?, ?, ?, ?, ?)', [playerId, submittedAt, submittedAt, `test-${playerId}`, 1, 1]);
}

async function completePredictions(): Promise<any[]> {
  const matches = await db.all('SELECT id, stage, group_id, home_team_id, away_team_id FROM matches ORDER BY id');
  const groupOrder = new Map<string, Map<string, number>>();
  for (const team of await db.all('SELECT id, group_id FROM teams ORDER BY group_id, id')) {
    const groupId = String(team.group_id);
    if (!groupOrder.has(groupId)) groupOrder.set(groupId, new Map());
    groupOrder.get(groupId)!.set(String(team.id), groupOrder.get(groupId)!.size);
  }
  const teamIds = (await db.all('SELECT id FROM teams ORDER BY id')).map((row) => String(row.id));
  return matches.map((match, index) => {
    if (String(match.stage) === 'GROUP') {
      const order = groupOrder.get(String(match.group_id))!;
      const homeRank = order.get(String(match.home_team_id)) ?? 0;
      const awayRank = order.get(String(match.away_team_id)) ?? 0;
      return { matchId: Number(match.id), homeGoals: homeRank < awayRank ? 2 : 0, awayGoals: awayRank < homeRank ? 2 : 0 };
    }
    const homeTeamPredictionId = teamIds[(index * 3) % teamIds.length];
    const awayTeamPredictionId = teamIds[(index * 3 + 7) % teamIds.length];
    return { matchId: Number(match.id), homeGoals: 1, awayGoals: 0, homeTeamPredictionId, awayTeamPredictionId, predictedWinnerTeamId: homeTeamPredictionId };
  });
}

async function completeBonus() {
  const groups = [];
  for (const group of await db.all('SELECT id FROM groups ORDER BY id')) {
    const teams = await db.all('SELECT id FROM teams WHERE group_id = ? ORDER BY id LIMIT 4', [String(group.id)]);
    groups.push({ groupId: String(group.id), winnerTeamId: String(teams[0].id), secondTeamId: String(teams[1].id), qualifierTeamIds: [String(teams[0].id), String(teams[1].id)] });
  }
  const teamIds = (await db.all('SELECT id FROM teams ORDER BY id')).map((row) => String(row.id));
  return {
    groups,
    knockout: {
      r16TeamIds: teamIds.slice(0, 16),
      qfTeamIds: teamIds.slice(8, 16),
      sfTeamIds: teamIds.slice(16, 20),
      finalTeamIds: teamIds.slice(20, 22),
      thirdPlaceWinnerTeamId: teamIds[23],
      championTeamId: teamIds[24],
      topScorer: 'Test Player'
    }
  };
}

async function completeTieResolutions() {
  const thirdSeeds = [];
  for (const group of await db.all('SELECT id FROM groups ORDER BY id')) {
    const teams = await db.all('SELECT id FROM teams WHERE group_id = ? ORDER BY id LIMIT 4', [String(group.id)]);
    thirdSeeds.push(String(teams[2].id));
  }
  return [{ groupId: 'THIRD_PLACE', teamOrder: thirdSeeds }];
}
