import { useMemo, useState } from 'react';
import type { GroupBonusPrediction, KnockoutBonusPrediction, Match, MatchPrediction, Team } from '../../domain/types.js';
import { recalculate, saveBonusResults, saveResult, setDeadline, setLock, updatePlayerStatus } from '../api.js';
import { readBonusDraft, splitTopScorers } from './bonusDraft.js';
import { TeamSelect } from './BonusPredictionPanel.js';
import { AdminDataStatus } from './DataStatus.js';
import { MatchCard } from './MatchPredictions.js';

export function AdminPanel({ state, player, onRefresh, onError }: { state: any; player: any; onRefresh: (state?: any) => void; onError: (message: string) => void }) {
  const [matchId, setMatchId] = useState(1);
  const match = useMemo(() => state.matches.find((item: Match) => item.id === matchId), [state.matches, matchId]);
  const teamsById = useMemo(() => new Map(state.teams.map((team: any) => [team.id, team as Team])), [state.teams]);
  const [result, setResult] = useState<MatchPrediction>({ matchId: 1, homeGoals: 0, awayGoals: 0 });
  const [deadlineValue, setDeadlineValue] = useState(toLocalDateTime(state.competition.prediction_deadline));
  const groupIds = state.groups.map((group: any) => String(group.id));
  const [bonus, setBonus] = useState(() => readBonusDraft(state.bonusResult, groupIds));
  const [adminCode, setAdminCode] = useState('');

  const updateGroup = (groupId: string, patch: Partial<GroupBonusPrediction>) => {
    setBonus((current) => ({ ...current, groups: current.groups.map((group) => group.groupId === groupId ? { ...group, ...patch } : group) }));
  };

  const updateKnockout = (patch: Partial<KnockoutBonusPrediction & { topScorersText?: string }>) => {
    setBonus((current) => ({ ...current, knockout: { ...current.knockout, ...patch } }));
  };

  const run = (promise: Promise<any>) => promise.then(onRefresh).catch((err) => onError(err.message));

  return (
    <section className="admin-grid">
      <AdminDataStatus status={state.tournamentDataStatus} />
      <div className="panel wide">
        <h2>Player approvals</h2>
        <label>Admin code<input type="password" value={adminCode} onChange={(event) => setAdminCode(event.target.value)} placeholder="Admin PIN" /></label>
        {['pending', 'approved', 'disabled'].map((status) => (
          <div className="admin-group" key={status}>
            <h3>{status}</h3>
            {(state.playerAdmin ?? []).filter((row: any) => row.status === status).map((row: any) => (
              <article className="leader-row" key={row.id}>
                <span>{row.display_name}</span>
                <span>{row.contact || 'No contact'}</span>
                <span>{row.prediction_count}/104</span>
                <span>{row.has_bonus_prediction ? 'Bonus saved' : 'Bonus missing'}</span>
                <span>{row.submitted_at ? new Date(row.submitted_at).toLocaleString() : 'Not submitted'}</span>
                <span>{row.updated_at ? `Updated ${new Date(row.updated_at).toLocaleDateString()}` : 'No update'}</span>
                {Number(row.duplicate_name_count) > 1 && <span>Duplicate name</span>}
                <button className="ghost" onClick={() => run(updatePlayerStatus(player.id, adminCode, row.id, 'approved'))}>Approve</button>
                <button className="ghost" onClick={() => run(updatePlayerStatus(player.id, adminCode, row.id, 'disabled'))}>Disable</button>
              </article>
            ))}
          </div>
        ))}
      </div>
      <div className="panel">
        <h2>Match result</h2>
        <select value={matchId} onChange={(event) => { const next = Number(event.target.value); setMatchId(next); setResult({ matchId: next, homeGoals: 0, awayGoals: 0 }); }}>
          {state.matches.map((item: Match) => <option key={item.id} value={item.id}>#{item.id} {item.homeSlot} v {item.awaySlot}</option>)}
        </select>
        {match && <MatchCard match={match} teamsById={teamsById} value={result} disabled={false} onChange={setResult} />}
        <button onClick={() => run(saveResult(player.id, adminCode, result))}>Save result</button>
      </div>
      <div className="panel">
        <h2>Deadline controls</h2>
        <label>Prediction deadline<input type="datetime-local" value={deadlineValue} onChange={(event) => setDeadlineValue(event.target.value)} /></label>
        <button onClick={() => run(setDeadline(player.id, adminCode, new Date(deadlineValue).toISOString()))}>Save deadline</button>
        <button onClick={() => run(setLock(player.id, adminCode, true))}>Lock predictions</button>
        <button onClick={() => run(setLock(player.id, adminCode, false))}>Unlock predictions</button>
        <button onClick={() => run(recalculate(player.id, adminCode))}>Recalculate all scores</button>
      </div>
      <div className="panel wide">
        <h2>Bonus results</h2>
        {groupIds.map((groupId: string) => {
          const group = bonus.groups.find((item) => item.groupId === groupId)!;
          const teams = state.teams.filter((team: any) => team.group_id === groupId);
          return (
            <div className="admin-group" key={groupId}>
              <h3>Group {groupId}</h3>
              <label>Winner<TeamSelect disabled={false} teams={teams} value={group.winnerTeamId} onChange={(winnerTeamId) => updateGroup(groupId, { winnerTeamId })} /></label>
              <label>Second<TeamSelect disabled={false} teams={teams} value={group.secondTeamId} onChange={(secondTeamId) => updateGroup(groupId, { secondTeamId })} /></label>
              <label>Qualifiers<input value={group.qualifierTeamIds.join(', ')} onChange={(event) => updateGroup(groupId, { qualifierTeamIds: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} placeholder="T01, T02" /></label>
            </div>
          );
        })}
        <RoundInput label="R16 teams" values={bonus.knockout.r16TeamIds} onChange={(r16TeamIds) => updateKnockout({ r16TeamIds })} />
        <RoundInput label="QF teams" values={bonus.knockout.qfTeamIds} onChange={(qfTeamIds) => updateKnockout({ qfTeamIds })} />
        <RoundInput label="SF teams" values={bonus.knockout.sfTeamIds} onChange={(sfTeamIds) => updateKnockout({ sfTeamIds })} />
        <RoundInput label="Final teams" values={bonus.knockout.finalTeamIds} onChange={(finalTeamIds) => updateKnockout({ finalTeamIds })} />
        <label>Third-place winner<TeamSelect disabled={false} teams={state.teams} value={bonus.knockout.thirdPlaceWinnerTeamId} onChange={(thirdPlaceWinnerTeamId) => updateKnockout({ thirdPlaceWinnerTeamId })} /></label>
        <label>World Cup winner<TeamSelect disabled={false} teams={state.teams} value={bonus.knockout.championTeamId} onChange={(championTeamId) => updateKnockout({ championTeamId })} /></label>
        <label>Top scorer result<input value={bonus.knockout.topScorer} onChange={(event) => updateKnockout({ topScorer: event.target.value })} placeholder="Primary top scorer" /></label>
        <label>Tied top scorers<textarea value={bonus.knockout.topScorersText ?? ''} onChange={(event) => updateKnockout({ topScorersText: event.target.value })} placeholder="One per line or comma separated" /></label>
        <button onClick={() => run(saveBonusResults(player.id, adminCode, bonus.groups, { ...bonus.knockout, topScorers: splitTopScorers(bonus.knockout.topScorersText || bonus.knockout.topScorer) }))}>Save bonus results</button>
      </div>
    </section>
  );
}

function RoundInput({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  return <label>{label}<input value={values.join(', ')} onChange={(event) => onChange(event.target.value.split(',').map((value) => value.trim()).filter(Boolean))} placeholder="T01, T02" /></label>;
}

function toLocalDateTime(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
