import { useMemo, useState } from 'react';
import type { GroupBonusPrediction, KnockoutBonusPrediction, Match, MatchPrediction, Team } from '../../domain/types.js';
import { recalculate, saveBonusResults, saveResult, setDeadline, setLock, updatePlayerStatus } from '../api.js';
import { readBonusDraft, splitTopScorers } from './bonusDraft.js';
import { TeamSelect } from './BonusPredictionPanel.js';
import { AdminDataStatus } from './DataStatus.js';
import { MatchCard } from './MatchPredictions.js';
import { errorEt } from '../lib/messages.js';

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

  const run = (promise: Promise<any>) => promise.then(onRefresh).catch((err) => onError(errorEt(err.message)));

  return (
    <section className="admin-grid">
      <AdminDataStatus status={state.tournamentDataStatus} />
      <div className="panel wide">
        <h2>Osalejate kinnitamine</h2>
        <label>Halduri kood<input type="password" value={adminCode} onChange={(event) => setAdminCode(event.target.value)} placeholder="Halduri PIN" /></label>
        {['pending', 'approved', 'disabled'].map((status) => (
          <div className="admin-group" key={status}>
            <h3>{statusLabel(status)}</h3>
            {(state.playerAdmin ?? []).filter((row: any) => row.status === status).map((row: any) => (
              <article className="leader-row" key={row.id}>
                <span>{row.display_name}</span>
                <span>{row.contact || 'Kontakt puudub'}</span>
                <span>{row.prediction_count}/104</span>
                <span>{row.has_bonus_prediction ? 'Boonus salvestatud' : 'Boonus puudu'}</span>
                <span>{row.submitted_at ? new Date(row.submitted_at).toLocaleString('et-EE') : 'Esitamata'}</span>
                <span>{row.updated_at ? `Uuendatud ${new Date(row.updated_at).toLocaleDateString('et-EE')}` : 'Uuendust pole'}</span>
                {Number(row.duplicate_name_count) > 1 && <span>Topeltnimi</span>}
                <button className="ghost" onClick={() => run(updatePlayerStatus(player.id, adminCode, row.id, 'approved'))}>Kinnita</button>
                <button className="ghost" onClick={() => run(updatePlayerStatus(player.id, adminCode, row.id, 'disabled'))}>Keela</button>
              </article>
            ))}
          </div>
        ))}
      </div>
      <div className="panel">
        <h2>Mängu tulemus</h2>
        <select value={matchId} onChange={(event) => { const next = Number(event.target.value); setMatchId(next); setResult({ matchId: next, homeGoals: 0, awayGoals: 0 }); }}>
          {state.matches.map((item: Match) => <option key={item.id} value={item.id}>#{item.id} {item.homeSlot} v {item.awaySlot}</option>)}
        </select>
        {match && <MatchCard match={match} teamsById={teamsById} value={result} disabled={false} onChange={setResult} />}
        <button onClick={() => run(saveResult(player.id, adminCode, result))}>Salvesta tulemus</button>
      </div>
      <div className="panel">
        <h2>Tähtaja juhtimine</h2>
        <label>Ennustuste tähtaeg<input type="datetime-local" value={deadlineValue} onChange={(event) => setDeadlineValue(event.target.value)} /></label>
        <button onClick={() => run(setDeadline(player.id, adminCode, new Date(deadlineValue).toISOString()))}>Salvesta tähtaeg</button>
        <button onClick={() => run(setLock(player.id, adminCode, true))}>Lukusta ennustused</button>
        <button onClick={() => run(setLock(player.id, adminCode, false))}>Ava ennustused</button>
        <button onClick={() => run(recalculate(player.id, adminCode))}>Arvuta punktid uuesti</button>
      </div>
      <div className="panel wide">
        <h2>Boonustulemused</h2>
        {groupIds.map((groupId: string) => {
          const group = bonus.groups.find((item) => item.groupId === groupId)!;
          const teams = state.teams.filter((team: any) => team.group_id === groupId);
          return (
            <div className="admin-group" key={groupId}>
              <h3>Alagrupp {groupId}</h3>
              <label>Võitja<TeamSelect disabled={false} teams={teams} value={group.winnerTeamId} onChange={(winnerTeamId) => updateGroup(groupId, { winnerTeamId })} /></label>
              <label>Teine koht<TeamSelect disabled={false} teams={teams} value={group.secondTeamId} onChange={(secondTeamId) => updateGroup(groupId, { secondTeamId })} /></label>
              <label>Edasipääsejad<input value={group.qualifierTeamIds.join(', ')} onChange={(event) => updateGroup(groupId, { qualifierTeamIds: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} placeholder="A1, A2" /></label>
            </div>
          );
        })}
        <RoundInput label="R16 riigid" values={bonus.knockout.r16TeamIds} onChange={(r16TeamIds) => updateKnockout({ r16TeamIds })} />
        <RoundInput label="Veerandfinaali riigid" values={bonus.knockout.qfTeamIds} onChange={(qfTeamIds) => updateKnockout({ qfTeamIds })} />
        <RoundInput label="Poolfinaali riigid" values={bonus.knockout.sfTeamIds} onChange={(sfTeamIds) => updateKnockout({ sfTeamIds })} />
        <RoundInput label="Finaali riigid" values={bonus.knockout.finalTeamIds} onChange={(finalTeamIds) => updateKnockout({ finalTeamIds })} />
        <label>3. koha võitja<TeamSelect disabled={false} teams={state.teams} value={bonus.knockout.thirdPlaceWinnerTeamId} onChange={(thirdPlaceWinnerTeamId) => updateKnockout({ thirdPlaceWinnerTeamId })} /></label>
        <label>Maailmameister<TeamSelect disabled={false} teams={state.teams} value={bonus.knockout.championTeamId} onChange={(championTeamId) => updateKnockout({ championTeamId })} /></label>
        <label>Suurim väravakütt<input value={bonus.knockout.topScorer} onChange={(event) => updateKnockout({ topScorer: event.target.value })} placeholder="Peamine väravakütt" /></label>
        <label>Jagatud parimad väravakütid<textarea value={bonus.knockout.topScorersText ?? ''} onChange={(event) => updateKnockout({ topScorersText: event.target.value })} placeholder="Üks rea kohta või komaga eraldatud" /></label>
        <button onClick={() => run(saveBonusResults(player.id, adminCode, bonus.groups, { ...bonus.knockout, topScorers: splitTopScorers(bonus.knockout.topScorersText || bonus.knockout.topScorer) }))}>Salvesta boonustulemused</button>
      </div>
    </section>
  );
}

function RoundInput({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  return <label>{label}<input value={values.join(', ')} onChange={(event) => onChange(event.target.value.split(',').map((value) => value.trim()).filter(Boolean))} placeholder="A1, A2" /></label>;
}

function toLocalDateTime(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function statusLabel(status: string): string {
  return ({ pending: 'Ootel', approved: 'Kinnitatud', disabled: 'Keelatud' } as Record<string, string>)[status] ?? status;
}
