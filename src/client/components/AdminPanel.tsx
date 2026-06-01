import { useMemo, useState } from 'react';
import type { GroupBonusPrediction, KnockoutBonusPrediction, Match, MatchPrediction, Team } from '../../domain/types.js';
import { deletePlayer, recalculate, saveBonusResults, saveResult, setDeadline, setLock, updatePlayerStatus } from '../api.js';
import { competitionStateLabel, defaultPlayerView, type CompetitionState } from '../lib/competitionState.js';
import { errorEt } from '../lib/messages.js';
import { readBonusDraft, splitTopScorers } from './bonusDraft.js';
import { TeamSelect } from './BonusPredictionPanel.js';
import { AdminDataStatus } from './DataStatus.js';
import { MatchCard } from './MatchPredictions.js';

type ParticipantStatus = 'pending' | 'approved' | 'disabled';

interface ParticipantRow {
  id: string;
  display_name: string;
  first_name?: string | null;
  last_name?: string | null;
  legacy_name_only?: number | boolean | null;
  status: ParticipantStatus;
  contact?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  final_submitted_at?: string | null;
  is_final?: number | boolean | null;
  prediction_count?: number | string | null;
  has_bonus_prediction?: number | boolean | null;
  duplicate_name_count?: number | string | null;
}

export function AdminPanel({ state, player, competitionState, onRefresh, onError }: { state: any; player: any; competitionState: CompetitionState; onRefresh: (state?: any) => void; onError: (message: string) => void }) {
  const [matchId, setMatchId] = useState(1);
  const match = useMemo(() => state.matches.find((item: Match) => item.id === matchId), [state.matches, matchId]);
  const teamsById = useMemo(() => new Map(state.teams.map((team: any) => [team.id, team as Team])), [state.teams]);
  const [result, setResult] = useState<MatchPrediction>({ matchId: 1, homeGoals: 0, awayGoals: 0 });
  const [deadlineValue, setDeadlineValue] = useState(toLocalDateTime(state.competition.prediction_deadline));
  const groupIds = state.groups.map((group: any) => String(group.id));
  const [bonus, setBonus] = useState(() => readBonusDraft(state.bonusResult, groupIds));
  const [deleteConfirmId, setDeleteConfirmId] = useState('');
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  const updateGroup = (groupId: string, patch: Partial<GroupBonusPrediction>) => {
    setBonus((current) => ({ ...current, groups: current.groups.map((group) => group.groupId === groupId ? { ...group, ...patch } : group) }));
  };

  const updateKnockout = (patch: Partial<KnockoutBonusPrediction & { topScorersText?: string }>) => {
    setBonus((current) => ({ ...current, knockout: { ...current.knockout, ...patch } }));
  };

  const run = (promise: Promise<any>) => promise.then(onRefresh).catch((err) => onError(errorEt(err.message)));
  const rows: ParticipantRow[] = state.playerAdmin ?? [];
  const deleteTarget = rows.find((row) => row.id === deleteConfirmId);

  const confirmDelete = (playerId: string) => {
    setDeleteConfirmId('');
    run(deletePlayer(playerId, deleteConfirmName));
    setDeleteConfirmName('');
  };

  return (
    <section className="admin-grid">
      <AdminDataStatus status={state.tournamentDataStatus} />

      <div className="panel wide">
        <h2>Võistluse seis</h2>
        <dl className="status-grid">
          <dt>Tähtaeg</dt><dd>{formatDateTime(state.competition.prediction_deadline)}</dd>
          <dt>Lukus</dt><dd>{state.competition.predictions_locked === 1 ? 'jah' : 'ei'}</dd>
          <dt>Olek</dt><dd>{competitionStateLabel(competitionState)}</dd>
          <dt>Vaikimisi vaade</dt><dd>{defaultPlayerView(competitionState) === 'results' ? 'Tulemused' : 'Ennustused'}</dd>
        </dl>
        <LaunchReadiness rows={rows} status={state.tournamentDataStatus} />
      </div>

      <div className="panel wide">
        <ParticipantManagement
          rows={rows}
          onStatus={(playerId, status) => run(updatePlayerStatus(playerId, status))}
          onDeleteStart={(row) => { setDeleteConfirmId(row.id); setDeleteConfirmName(''); }}
        />
      </div>

      {deleteTarget && (
        <DeletePlayerDialog
          row={deleteTarget}
          value={deleteConfirmName}
          onChange={setDeleteConfirmName}
          onCancel={() => { setDeleteConfirmId(''); setDeleteConfirmName(''); }}
          onConfirm={() => confirmDelete(deleteTarget.id)}
        />
      )}

      <div className="panel">
        <h2>Mängu tulemus</h2>
        <select value={matchId} onChange={(event) => { const next = Number(event.target.value); setMatchId(next); setResult({ matchId: next, homeGoals: 0, awayGoals: 0 }); }}>
          {state.matches.map((item: Match) => <option key={item.id} value={item.id}>#{item.id} {item.homeSlot} v {item.awaySlot}</option>)}
        </select>
        {match && <MatchCard match={match} teamsById={teamsById} value={result} disabled={false} onChange={setResult} />}
        <button onClick={() => run(saveResult(result))}>Salvesta tulemus</button>
      </div>

      <div className="panel">
        <h2>Tähtaja juhtimine</h2>
        <label>Ennustuste tähtaeg<input type="datetime-local" value={deadlineValue} onChange={(event) => setDeadlineValue(event.target.value)} /></label>
        <button onClick={() => run(setDeadline(new Date(deadlineValue).toISOString()))}>Salvesta tähtaeg</button>
        <button onClick={() => run(setLock(true))}>Lukusta ennustused</button>
        <button onClick={() => run(setLock(false))}>Ava ennustused</button>
        <button onClick={() => run(recalculate())}>Arvuta punktid uuesti</button>
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
        <RoundInput label="1/16-finaali riigid" values={bonus.knockout.r16TeamIds} onChange={(r16TeamIds) => updateKnockout({ r16TeamIds })} />
        <RoundInput label="Veerandfinaali riigid" values={bonus.knockout.qfTeamIds} onChange={(qfTeamIds) => updateKnockout({ qfTeamIds })} />
        <RoundInput label="Poolfinaali riigid" values={bonus.knockout.sfTeamIds} onChange={(sfTeamIds) => updateKnockout({ sfTeamIds })} />
        <RoundInput label="Finaali riigid" values={bonus.knockout.finalTeamIds} onChange={(finalTeamIds) => updateKnockout({ finalTeamIds })} />
        <label>3. koha võitja<TeamSelect disabled={false} teams={state.teams} value={bonus.knockout.thirdPlaceWinnerTeamId} onChange={(thirdPlaceWinnerTeamId) => updateKnockout({ thirdPlaceWinnerTeamId })} /></label>
        <label>Maailmameister<TeamSelect disabled={false} teams={state.teams} value={bonus.knockout.championTeamId} onChange={(championTeamId) => updateKnockout({ championTeamId })} /></label>
        <label>Suurim väravakütt<input value={bonus.knockout.topScorer} onChange={(event) => updateKnockout({ topScorer: event.target.value })} placeholder="Peamine väravakütt" /></label>
        <label>Jagatud parimad väravakütid<textarea value={bonus.knockout.topScorersText ?? ''} onChange={(event) => updateKnockout({ topScorersText: event.target.value })} placeholder="Üks rea kohta või komaga eraldatud" /></label>
        <button onClick={() => run(saveBonusResults(bonus.groups, { ...bonus.knockout, topScorers: splitTopScorers(bonus.knockout.topScorersText || bonus.knockout.topScorer) }))}>Salvesta boonustulemused</button>
      </div>
    </section>
  );
}

export function ParticipantManagement({ rows, onStatus, onDeleteStart }: { rows: ParticipantRow[]; onStatus: (playerId: string, status: ParticipantStatus) => void; onDeleteStart: (row: ParticipantRow) => void }) {
  const groups: ParticipantStatus[] = ['pending', 'approved', 'disabled'];
  return (
    <section className="participant-management">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Osalejad</p>
          <h2>Osalejate kinnitamine</h2>
        </div>
        <span className="count-pill">{rows.length} kokku</span>
      </div>
      {groups.map((status) => {
        const groupRows = rows.filter((row) => row.status === status);
        return (
          <details className="participant-group" key={status} open={status === 'pending'}>
            <summary>
              <span>{statusHeading(status)} ({groupRows.length})</span>
              <small>{statusHelp(status)}</small>
            </summary>
            {groupRows.length === 0 ? (
              <p className="participant-empty">Selles jaotuses osalejaid ei ole.</p>
            ) : (
              <div className="participant-list">
                {groupRows.map((row) => (
                  <ParticipantCard key={row.id} row={row} onStatus={onStatus} onDeleteStart={onDeleteStart} />
                ))}
              </div>
            )}
          </details>
        );
      })}
    </section>
  );
}

function ParticipantCard({ row, onStatus, onDeleteStart }: { row: ParticipantRow; onStatus: (playerId: string, status: ParticipantStatus) => void; onDeleteStart: (row: ParticipantRow) => void }) {
  const legacy = isLegacyParticipant(row);
  const hasBonus = Boolean(Number(row.has_bonus_prediction ?? 0));
  const final = Boolean(Number(row.is_final ?? 0));
  const predictionCount = Number(row.prediction_count ?? 0);

  return (
    <article className="participant-card">
      <div className="participant-main">
        <div>
          <div className="participant-title-row">
            <h3>{row.display_name}</h3>
            <span className={`status-badge ${row.status}`}>{statusLabel(row.status)}</span>
            {legacy && <span className="status-badge warning">Vana testkirje</span>}
            {Number(row.duplicate_name_count ?? 0) > 1 && <span className="status-badge warning">Topeltnimi</span>}
          </div>
          <p className="participant-contact">{row.contact || 'Kontakt puudub'}</p>
        </div>
        <dl className="participant-dates">
          <div><dt>Registreerus</dt><dd>{formatDate(row.created_at)}</dd></div>
          <div><dt>Viimati uuendatud</dt><dd>{formatDate(row.updated_at)}</dd></div>
          <div><dt>Lõplik ennustus</dt><dd>{row.final_submitted_at ? formatDateTime(row.final_submitted_at) : 'esitamata'}</dd></div>
        </dl>
      </div>

      <div className="participant-progress" aria-label={`${row.display_name} ennustuste seis`}>
        <span className={predictionCount >= 104 ? 'progress-chip ok' : 'progress-chip'}>Mängud: {predictionCount}/104</span>
        <span className={hasBonus ? 'progress-chip ok' : 'progress-chip warning'}>Boonused: {hasBonus ? 'täidetud' : 'puudu'}</span>
        <span className={final ? 'progress-chip ok' : 'progress-chip warning'}>{final ? 'Lõplikult esitatud' : 'Lõplikult esitamata'}</span>
      </div>

      <div className="participant-actions">
        <button className="ghost primary-action" onClick={() => onStatus(row.id, 'approved')}>Kinnita osaleja</button>
        <button className="ghost compact-action" onClick={() => onStatus(row.id, 'disabled')}>Keela</button>
        <button className="ghost danger delete-action" onClick={() => onDeleteStart(row)}>Eemalda testkasutaja</button>
      </div>
    </article>
  );
}

export function DeletePlayerDialog({ row, value, onChange, onCancel, onConfirm }: { row: ParticipantRow; value: string; onChange: (value: string) => void; onCancel: () => void; onConfirm: () => void }) {
  const disabled = value.trim() !== row.display_name;
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-player-title">
        <p className="eyebrow">Kustutamine</p>
        <h2 id="delete-player-title">Eemalda testkasutaja</h2>
        <p><strong>{row.display_name}</strong>{isLegacyParticipant(row) ? ' on vana või puudulik testkirje.' : ' eemaldatakse ainult valitud osalejana.'}</p>
        <p className="warning-text">See eemaldab selle osaleja ennustused, lõpliku esituse ja punktiread. Teisi osalejaid, tulemusi ega turniiriandmeid ei muudeta.</p>
        <label>
          Sisesta täpne nimi kustutamise kinnitamiseks
          <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={row.display_name} autoFocus />
        </label>
        <div className="dialog-actions">
          <button className="ghost" onClick={onCancel}>Tühista</button>
          <button className="ghost danger" onClick={onConfirm} disabled={disabled}>Kinnita kustutamine</button>
        </div>
      </section>
    </div>
  );
}

function LaunchReadiness({ rows, status }: { rows: ParticipantRow[]; status: any }) {
  const pending = rows.filter((row) => row.status === 'pending').length;
  const approved = rows.filter((row) => row.status === 'approved').length;
  const approvedFinal = rows.filter((row) => row.status === 'approved' && Number(row.is_final ?? 0) === 1).length;
  const incomplete = rows.filter((row) => row.status !== 'disabled' && Number(row.is_final ?? 0) !== 1).length;
  const testRecords = rows.filter(isLegacyParticipant).length;
  const needsWarning = testRecords > 0 || incomplete > 0;

  return (
    <section className="launch-readiness">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Kontroll</p>
          <h3>Stardivalmiduse kontroll</h3>
        </div>
      </div>
      <div className="readiness-tiles">
        <ReadinessTile label="Ootel" value={pending} />
        <ReadinessTile label="Kinnitatud" value={approved} />
        <ReadinessTile label="Lõplikult esitanud" value={approvedFinal} />
        <ReadinessTile label="Esitamata / pooleli" value={incomplete} tone={incomplete > 0 ? 'warning' : 'ok'} />
        <ReadinessTile label="Testkasutajaid" value={testRecords} tone={testRecords > 0 ? 'warning' : 'ok'} />
        <ReadinessTile label="Turniiriandmed" value={verificationStatusEt(status?.metadata?.verificationStatus)} />
      </div>
      {needsWarning && <p className="readiness-warning">Enne lingi jagamist eemalda testkasutajad ja kontrolli lõplikult esitatud ennustused.</p>}
    </section>
  );
}

function ReadinessTile({ label, value, tone }: { label: string; value: string | number; tone?: 'ok' | 'warning' }) {
  return <div className={`readiness-tile ${tone ?? ''}`}><span>{label}</span><strong>{value}</strong></div>;
}

function RoundInput({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  return <label>{label}<input value={values.join(', ')} onChange={(event) => onChange(event.target.value.split(',').map((value) => value.trim()).filter(Boolean))} placeholder="A1, A2" /></label>;
}

function toLocalDateTime(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function statusHeading(status: ParticipantStatus): string {
  return ({ pending: 'Ootel', approved: 'Kinnitatud', disabled: 'Keelatud' } satisfies Record<ParticipantStatus, string>)[status];
}

function statusLabel(status: string): string {
  return ({ pending: 'Ootel', approved: 'Kinnitatud', disabled: 'Keelatud' } as Record<string, string>)[status] ?? status;
}

function statusHelp(status: ParticipantStatus): string {
  return ({
    pending: 'Vajavad korraldaja kinnitust',
    approved: 'Arvestusse kaasatud osalejad',
    disabled: 'Edetabelist ja arvestusest eemaldatud'
  } satisfies Record<ParticipantStatus, string>)[status];
}

function isLegacyParticipant(row: ParticipantRow): boolean {
  return Boolean(Number(row.legacy_name_only ?? 0)) || !row.first_name || !row.last_name;
}

function formatDateTime(value?: string | null): string {
  if (!value) return 'puudub';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'puudub';
  return date.toLocaleString('et-EE', { dateStyle: 'short', timeStyle: 'short' });
}

function formatDate(value?: string | null): string {
  if (!value) return 'puudub';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'puudub';
  return date.toLocaleDateString('et-EE', { dateStyle: 'short' });
}

function verificationStatusEt(value?: string): string {
  return ({
    official: 'Kinnitatud',
    partial_official: 'Osaliselt kinnitatud',
    seeded: 'Näidisandmed',
    manual: 'Käsitsi sisestatud',
    unknown: 'Teadmata'
  } as Record<string, string>)[value ?? 'unknown'] ?? 'Teadmata';
}
