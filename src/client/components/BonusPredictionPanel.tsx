import { useState } from 'react';
import type { GroupBonusPrediction, KnockoutBonusPrediction, Team } from '../../domain/types.js';
import { teamNameEt } from '../lib/messages.js';
import { DeadlineBanner } from './DeadlineBanner.js';
import { countMissingBonus, readBonusDraft, toggleTeam } from './bonusDraft.js';
import { TeamBadge } from './TeamBadge.js';

export function BonusPredictionPanel({ state, locked, saving, onSave }: { state: any; locked: boolean; saving: string; onSave: (groups: GroupBonusPrediction[], knockout: KnockoutBonusPrediction) => void }) {
  const groupIds = state.groups.map((group: any) => String(group.id));
  const [draft, setDraft] = useState(() => readBonusDraft(state.bonusPrediction, groupIds));
  const missing = countMissingBonus(draft);

  return (
    <section>
      <div className="summary">
        <strong>{missing === 0 ? 'Valmis' : `${missing} puudu`}</strong>
        <span>{locked ? 'Eriennustused on lukus' : saving || 'Eriennustusi saab muuta'}</span>
      </div>
      <DeadlineBanner deadline={state.competition.prediction_deadline} locked={locked} />
      <div className="data-status official">
        <strong>Alagrupi boonused arvutatakse mänguennustustest.</strong>
        <small>Alagrupi võitjat, teist kohta ja edasipääsejaid ei pea siin käsitsi kordama.</small>
      </div>
      <div className="stack">
        <article className="panel">
          <h2>Eriennustused</h2>
          <RoundChecks label="Kaheksandikfinaali jõudjad" max={16} teams={state.teams} values={draft.knockout.r16TeamIds} disabled={locked} onChange={(r16TeamIds) => setDraft((current) => ({ ...current, knockout: { ...current.knockout, r16TeamIds } }))} />
          <RoundChecks label="Veerandfinaali jõudjad" max={8} teams={state.teams} values={draft.knockout.qfTeamIds} disabled={locked} onChange={(qfTeamIds) => setDraft((current) => ({ ...current, knockout: { ...current.knockout, qfTeamIds } }))} />
          <RoundChecks label="Poolfinaali jõudjad" max={4} teams={state.teams} values={draft.knockout.sfTeamIds} disabled={locked} onChange={(sfTeamIds) => setDraft((current) => ({ ...current, knockout: { ...current.knockout, sfTeamIds } }))} />
          <RoundChecks label="Finaali jõudjad" max={2} teams={state.teams} values={draft.knockout.finalTeamIds} disabled={locked} onChange={(finalTeamIds) => setDraft((current) => ({ ...current, knockout: { ...current.knockout, finalTeamIds } }))} />
          <label>3. koha mängu võitja<TeamSelect disabled={locked} teams={state.teams} value={draft.knockout.thirdPlaceWinnerTeamId} onChange={(thirdPlaceWinnerTeamId) => setDraft((current) => ({ ...current, knockout: { ...current.knockout, thirdPlaceWinnerTeamId } }))} /></label>
          <label>Maailmameister<TeamSelect disabled={locked} teams={state.teams} value={draft.knockout.championTeamId} onChange={(championTeamId) => setDraft((current) => ({ ...current, knockout: { ...current.knockout, championTeamId } }))} /></label>
          <label>Suurim väravakütt<input disabled={locked} value={draft.knockout.topScorer} onChange={(event) => setDraft((current) => ({ ...current, knockout: { ...current.knockout, topScorer: event.target.value } }))} placeholder="Mängija nimi" /></label>
        </article>
      </div>
      <button className="sticky-save" disabled={locked} onClick={() => onSave([], draft.knockout)}>Salvesta eriennustused</button>
    </section>
  );
}

export function TeamSelect({ teams, value, disabled, onChange }: { teams: Team[]; value: string; disabled: boolean; onChange: (value: string) => void }) {
  const selectedTeam = teams.find((team: any) => team.id === value);
  return (
    <div className="team-select">
      {selectedTeam && <TeamBadge team={selectedTeam} />}
      <select disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Vali riik</option>
        {teams.map((team: any) => <option key={team.id} value={team.id}>{teamNameEt(team)} ({team.code})</option>)}
      </select>
    </div>
  );
}

function RoundChecks({ label, max, teams, values, disabled, onChange }: { label: string; max: number; teams: Team[]; values: string[]; disabled: boolean; onChange: (values: string[]) => void }) {
  return <div><FieldLabel text={`${label} (${values.length}/${max})`} missing={values.length < max} /><TeamChecks disabled={disabled} teams={teams} values={values} max={max} onChange={onChange} /></div>;
}

function TeamChecks({ teams, values, max, disabled, onChange }: { teams: Team[]; values: string[]; max: number; disabled: boolean; onChange: (values: string[]) => void }) {
  return <div className="check-grid">{teams.map((team: any) => <label className="check-row" key={team.id}><input disabled={disabled || (!values.includes(team.id) && values.length >= max)} type="checkbox" checked={values.includes(team.id)} onChange={() => onChange(toggleTeam(values, team.id, max))} /><TeamBadge team={team} /></label>)}</div>;
}

function FieldLabel({ text, missing }: { text: string; missing: boolean }) {
  return <p className={missing ? 'field-note missing' : 'field-note'}>{text}</p>;
}
