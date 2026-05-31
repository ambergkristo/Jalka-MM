import { useMemo, useState } from 'react';
import type { Match, MatchPrediction, Team } from '../../domain/types.js';
import { formatEstoniaKickoffTime, formatMatchDate } from '../lib/date.js';
import { et, teamNameEt } from '../lib/messages.js';
import { UserDataStatus } from './DataStatus.js';
import { DeadlineBanner } from './DeadlineBanner.js';
import { TeamBadge } from './TeamBadge.js';

export function MatchPredictions({ state, locked, saving, onSave, onFinalSubmit }: { state: any; locked: boolean; saving: string; onSave: (predictions: MatchPrediction[]) => void; onFinalSubmit: () => void }) {
  const existing = new Map(state.predictions.map((row: any) => [Number(row.match_id), row]));
  const [stage, setStage] = useState('GROUP');
  const teamsById = useMemo(() => new Map(state.teams.map((team: any) => [team.id, team as Team])), [state.teams]);
  const [draft, setDraft] = useState<Record<number, MatchPrediction>>(() => applyPropagation(Object.fromEntries(state.matches.map((match: Match | any) => [match.id, {
    matchId: match.id,
    homeGoals: Number(existing.get(match.id)?.home_goals ?? 0),
    awayGoals: Number(existing.get(match.id)?.away_goals ?? 0),
    penaltyWinner: existing.get(match.id)?.penalty_winner ?? undefined,
    homeTeamPredictionId: existing.get(match.id)?.home_team_prediction_id ?? match.homeTeamId ?? match.home_team_id ?? undefined,
    awayTeamPredictionId: existing.get(match.id)?.away_team_prediction_id ?? match.awayTeamId ?? match.away_team_id ?? undefined,
    predictedWinnerTeamId: existing.get(match.id)?.predicted_winner_team_id ?? undefined
  }])) as Record<number, MatchPrediction>, state.matches));
  const matches = state.matches.filter((match: Match) => match.stage === stage);
  const completed = Object.values(draft).filter((prediction) => Number.isInteger(prediction.homeGoals) && Number.isInteger(prediction.awayGoals)).length;
  const groupedMatches = stage === 'GROUP' ? groupMatches(matches) : [[stageLabel(stage), matches]] as Array<[string, Match[]]>;
  const submission = state.submission;

  function updateMatch(matchId: number, value: MatchPrediction) {
    setDraft((current) => applyPropagation({ ...current, [matchId]: value }, state.matches));
  }

  return (
    <section>
      <div className="summary">
        <strong>{completed}/104</strong>
        <span>{locked ? 'Ennustused on lukus' : saving || 'Ennustusi saab muuta'}</span>
      </div>
      <DeadlineBanner deadline={state.competition.prediction_deadline} locked={locked} />
      <SubmissionStatus submission={submission} draft={draft} />
      <UserDataStatus status={state.tournamentDataStatus} />
      <div className="filters">{['GROUP', 'R32', 'R16', 'QF', 'SF', 'THIRD_PLACE', 'FINAL'].map((item) => <button key={item} className={stage === item ? 'active' : ''} onClick={() => setStage(item)}>{stageLabel(item)}</button>)}</div>
      <div className="match-list">
        {groupedMatches.map(([heading, sectionMatches]) => (
          <section className="match-section" key={heading}>
            <h2>{heading}</h2>
            {sectionMatches.map((match: Match) => <MatchCard key={match.id} match={match} teams={state.teams} teamsById={teamsById} value={draft[match.id]} disabled={locked} onChange={(value) => updateMatch(match.id, value)} />)}
          </section>
        ))}
      </div>
      <div className="sticky-actions">
        <button disabled={locked} onClick={() => onSave(Object.values(draft))}>Salvesta mustand</button>
        <button disabled={locked || !isComplete(draft, state.matches)} onClick={onFinalSubmit}>Kinnita lõplik ennustus</button>
      </div>
    </section>
  );
}

function SubmissionStatus({ submission, draft }: { submission: any; draft: Record<number, MatchPrediction> }) {
  const needsConfirmation = Object.values(draft).some((prediction: any) => prediction.needs_final_confirmation === 1);
  if (submission?.is_final === 1 && !needsConfirmation) return <div className="deadline-banner"><strong>Ennustus esitatud: {new Date(submission.final_submitted_at).toLocaleString('et-EE')}</strong><span>Lõplikku versiooni kasutatakse viigi korral ajavõrdluses.</span></div>;
  if (submission?.is_final === 1) return <div className="deadline-banner warning"><strong>Mustandit on muudetud</strong><span>Muudatused ei ole lõplikud enne uut kinnitamist.</span></div>;
  return <div className="deadline-banner warning"><strong>Lõplik ennustus kinnitamata</strong><span>Mustandi salvestamine ei anna edetabeli viigimurdja aega.</span></div>;
}

export function MatchCard({ match, value, disabled, onChange, teams, teamsById = new Map() }: { match: Match | any; value: MatchPrediction; disabled: boolean; onChange: (value: MatchPrediction) => void; teams?: Team[]; teamsById?: Map<string, Team> }) {
  const isKnockout = match.stage !== 'GROUP';
  const tiedKnockout = isKnockout && Number(value.homeGoals) === Number(value.awayGoals);
  const kickoff = match.kickoffAt ?? match.kickoff_at;
  const homeTeam = value.homeTeamPredictionId ? teamsById.get(value.homeTeamPredictionId) : match.homeTeamId || match.home_team_id ? teamsById.get(match.homeTeamId ?? match.home_team_id) : null;
  const awayTeam = value.awayTeamPredictionId ? teamsById.get(value.awayTeamPredictionId) : match.awayTeamId || match.away_team_id ? teamsById.get(match.awayTeamId ?? match.away_team_id) : null;
  const groupId = match.groupId ?? match.group_id;
  const helperHome = slotLabelEt(match.homeSlot ?? match.home_slot);
  const helperAway = slotLabelEt(match.awaySlot ?? match.away_slot);
  return (
    <article className="match-card">
      <div className="match-meta">
        <span>{groupId ? `Alagrupp ${groupId}` : stageLabel(match.stage)} · Mäng {match.id}</span>
        <span>{match.stage === 'GROUP' ? formatEstoniaKickoffTime(kickoff) : formatMatchDate(kickoff)}</span>
      </div>
      {isKnockout && <div className="slot-helper"><span>{helperHome}</span><span>{helperAway}</span></div>}
      {isKnockout && teams && (
        <div className="knockout-team-selects">
          <TeamSearch label="Kodutiim" teams={teams} value={value.homeTeamPredictionId} disabled={disabled || isPreviousMatchSlot(match.homeSlot ?? match.home_slot)} onChange={(teamId) => onChange({ ...value, homeTeamPredictionId: teamId, penaltyWinner: undefined, predictedWinnerTeamId: undefined })} />
          <TeamSearch label="Võõrsiltiim" teams={teams} value={value.awayTeamPredictionId} disabled={disabled || isPreviousMatchSlot(match.awaySlot ?? match.away_slot)} onChange={(teamId) => onChange({ ...value, awayTeamPredictionId: teamId, penaltyWinner: undefined, predictedWinnerTeamId: undefined })} />
        </div>
      )}
      <div className="score-row">
        <TeamBadge team={homeTeam} slotLabel={helperHome} />
        <input disabled={disabled} type="number" min="0" value={value.homeGoals} onChange={(event) => onChange({ ...value, homeGoals: Number(event.target.value), penaltyWinner: undefined })} />
        <input disabled={disabled} type="number" min="0" value={value.awayGoals} onChange={(event) => onChange({ ...value, awayGoals: Number(event.target.value), penaltyWinner: undefined })} />
        <TeamBadge team={awayTeam} slotLabel={helperAway} align="right" />
      </div>
      {tiedKnockout && <select disabled={disabled} value={value.penaltyWinner ?? ''} onChange={(event) => onChange({ ...value, penaltyWinner: event.target.value as MatchPrediction['penaltyWinner'] })}>
        <option value="">Penaltiseeria võitja</option><option value="HOME">{homeTeam ? teamNameEt(homeTeam) : helperHome}</option><option value="AWAY">{awayTeam ? teamNameEt(awayTeam) : helperAway}</option>
      </select>}
      {isKnockout && value.predictedWinnerTeamId && <p className="field-note">Edasipääseja: {teamNameEt(teamsById.get(value.predictedWinnerTeamId))}</p>}
    </article>
  );
}

function TeamSearch({ label, teams, value, disabled, onChange }: { label: string; teams: Team[]; value?: string; disabled: boolean; onChange: (teamId: string | undefined) => void }) {
  const selected = teams.find((team: any) => team.id === value);
  const listId = `${label.replace(/\s+/g, '-')}-teams`;
  return (
    <label>{label}
      <input disabled={disabled} list={listId} value={selected ? `${teamNameEt(selected)} (${selected.code})` : ''} placeholder="Otsi riiki" onChange={(event) => {
        const text = event.target.value.toLocaleLowerCase('et-EE');
        const team = teams.find((item: any) => `${teamNameEt(item)} (${item.code})`.toLocaleLowerCase('et-EE') === text || teamNameEt(item).toLocaleLowerCase('et-EE') === text);
        onChange(team?.id);
      }} />
      <datalist id={listId}>{teams.map((team: any) => <option key={team.id} value={`${teamNameEt(team)} (${team.code})`} />)}</datalist>
      {selected && <TeamBadge team={selected} />}
    </label>
  );
}

function applyPropagation(draft: Record<number, MatchPrediction>, matches: any[]): Record<number, MatchPrediction> {
  const next = { ...draft };
  const matchById = new Map(matches.map((match) => [Number(match.id), match]));
  for (const match of matches.filter((item) => item.stage !== 'GROUP').sort((a, b) => Number(a.id) - Number(b.id))) {
    const current = next[match.id];
    if (!current) continue;
    next[match.id] = { ...current, predictedWinnerTeamId: predictedWinner(current) };
    for (const later of matches.filter((item) => Number(item.id) > Number(match.id))) {
      const laterPrediction = next[later.id];
      if (!laterPrediction) continue;
      if (slotReferences(later.homeSlot ?? later.home_slot, match.id, 'Winner')) next[later.id] = { ...laterPrediction, homeTeamPredictionId: next[match.id].predictedWinnerTeamId };
      if (slotReferences(later.awaySlot ?? later.away_slot, match.id, 'Winner')) next[later.id] = { ...next[later.id], awayTeamPredictionId: next[match.id].predictedWinnerTeamId };
      if (slotReferences(later.homeSlot ?? later.home_slot, match.id, 'Loser')) next[later.id] = { ...laterPrediction, homeTeamPredictionId: predictedLoser(next[match.id]) };
      if (slotReferences(later.awaySlot ?? later.away_slot, match.id, 'Loser')) next[later.id] = { ...next[later.id], awayTeamPredictionId: predictedLoser(next[match.id]) };
    }
    if (!matchById.has(match.id)) continue;
  }
  return next;
}

function predictedWinner(prediction: MatchPrediction): string | undefined {
  if (prediction.homeGoals > prediction.awayGoals) return prediction.homeTeamPredictionId;
  if (prediction.awayGoals > prediction.homeGoals) return prediction.awayTeamPredictionId;
  if (prediction.penaltyWinner === 'HOME') return prediction.homeTeamPredictionId;
  if (prediction.penaltyWinner === 'AWAY') return prediction.awayTeamPredictionId;
  return undefined;
}

function predictedLoser(prediction: MatchPrediction): string | undefined {
  const winner = predictedWinner(prediction);
  if (!winner) return undefined;
  return winner === prediction.homeTeamPredictionId ? prediction.awayTeamPredictionId : prediction.homeTeamPredictionId;
}

function slotReferences(slot: string, matchId: number, type: 'Winner' | 'Loser') {
  return String(slot).toLowerCase() === `${type.toLowerCase()} match ${matchId}`;
}

function isPreviousMatchSlot(slot: string) {
  return /^(Winner|Loser) Match \d+$/i.test(String(slot));
}

function isComplete(draft: Record<number, MatchPrediction>, matches: any[]): boolean {
  return matches.every((match) => {
    const prediction = draft[match.id];
    if (!prediction || !Number.isInteger(prediction.homeGoals) || !Number.isInteger(prediction.awayGoals)) return false;
    if (match.stage !== 'GROUP') {
      if (!prediction.homeTeamPredictionId || !prediction.awayTeamPredictionId || !prediction.predictedWinnerTeamId) return false;
      if (prediction.homeGoals === prediction.awayGoals && !prediction.penaltyWinner) return false;
    }
    return true;
  });
}

function groupMatches(matches: Match[]): Array<[string, Match[]]> {
  const groups = new Map<string, Match[]>();
  for (const match of matches as any[]) {
    const groupId = match.groupId ?? match.group_id ?? 'Muu';
    groups.set(groupId, [...(groups.get(groupId) ?? []), match]);
  }
  return [...groups.entries()].map(([groupId, groupMatches]) => [`Alagrupp ${groupId}`, groupMatches]);
}

export function stageLabel(stage: string) {
  return (et.stages as Record<string, string>)[stage] ?? stage;
}

export function slotLabelEt(slot: string): string {
  return String(slot)
    .replace(/Group ([A-L]) winners/g, '$1-grupi võitja')
    .replace(/Group ([A-L]) runners-up/g, '$1-grupi teine koht')
    .replace(/Group ([A-L/]+) third place/g, 'Parim 3. koha meeskond ($1)')
    .replace(/Winner Match (\d+)/g, 'Mängu $1 võitja')
    .replace(/Loser Match (\d+)/g, 'Mängu $1 kaotaja');
}
