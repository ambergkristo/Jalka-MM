import { useMemo, useState } from 'react';
import { derivePredictedGroupOutcomes, type GroupTieIssue } from '../../domain/predictedGroups.js';
import type { Match, MatchPrediction, Team } from '../../domain/types.js';
import { formatEstoniaKickoffTime, formatMatchDate } from '../lib/date.js';
import { et, teamNameEt } from '../lib/messages.js';
import { countMissingBonus, readBonusDraft } from './bonusDraft.js';
import { DeadlineBanner } from './DeadlineBanner.js';
import { UserDataStatus } from './DataStatus.js';
import { TeamBadge } from './TeamBadge.js';

export function MatchPredictions({ state, locked, saving, onSave, onFinalSubmit }: { state: any; locked: boolean; saving: string; onSave: (predictions: MatchPrediction[], tieResolutions: any[]) => void; onFinalSubmit: () => void }) {
  const existing = new Map(state.predictions.map((row: any) => [Number(row.match_id), row]));
  const [stage, setStage] = useState('GROUP');
  const teamsById = useMemo(() => new Map(state.teams.map((team: any) => [team.id, team as Team])), [state.teams]);
  const [draft, setDraft] = useState<Record<number, MatchPrediction>>(() => Object.fromEntries(state.matches.map((match: Match | any) => [match.id, normalizeMatchPrediction({
    matchId: match.id,
    homeGoals: Number(existing.get(match.id)?.home_goals ?? 0),
    awayGoals: Number(existing.get(match.id)?.away_goals ?? 0),
    penaltyWinner: existing.get(match.id)?.penalty_winner ?? undefined,
    homeTeamPredictionId: existing.get(match.id)?.home_team_prediction_id ?? match.homeTeamId ?? match.home_team_id ?? undefined,
    awayTeamPredictionId: existing.get(match.id)?.away_team_prediction_id ?? match.awayTeamId ?? match.away_team_id ?? undefined,
    predictedWinnerTeamId: existing.get(match.id)?.predicted_winner_team_id ?? undefined
  })])) as Record<number, MatchPrediction>);
  const [tieResolutions, setTieResolutions] = useState(() => (state.tieResolutions ?? []).map((row: any) => ({ groupId: String(row.group_id ?? row.groupId), teamOrder: JSON.parse(String(row.team_order_json ?? '[]')) })));
  const matches = state.matches.filter((match: Match) => match.stage === stage);
  const groupedMatches = stage === 'GROUP' ? groupMatches(matches) : [[stageLabel(stage), matches]] as Array<[string, Match[]]>;
  const submission = state.submission;
  const groupOutcomes = useMemo(() => derivePredictedGroupOutcomes(state.teams, state.matches, Object.values(draft), tieResolutions), [state.teams, state.matches, draft, tieResolutions]);
  const bonusDraft = useMemo(() => readBonusDraft(state.bonusPrediction, state.groups.map((group: any) => String(group.id))), [state.bonusPrediction, state.groups]);
  const bonusMissing = countMissingBonus(bonusDraft);
  const completion = useMemo(() => predictionCompletion(state.matches, draft, groupOutcomes.unresolvedTies.length, bonusMissing, state.currentPlayer, submission), [state.matches, draft, groupOutcomes.unresolvedTies.length, bonusMissing, state.currentPlayer, submission]);

  function updateMatch(matchId: number, value: MatchPrediction) {
    setDraft((current) => ({ ...current, [matchId]: normalizeMatchPrediction(value) }));
  }

  return (
    <section>
      <div className="summary">
        <strong>{completion.percent}%</strong>
        <span>{locked ? 'Ennustused on lukus' : saving || completion.message}</span>
      </div>
      <DeadlineBanner deadline={state.competition.prediction_deadline} locked={locked} />
      <SubmissionStatus submission={submission} draft={draft} />
      <CompletionSummary completion={completion} setStage={setStage} />
      <UserDataStatus status={state.tournamentDataStatus} />
      <div className="filters">{['GROUP', 'R32', 'R16', 'QF', 'SF', 'THIRD_PLACE', 'FINAL'].map((item) => <button key={item} className={stage === item ? 'active' : ''} onClick={() => setStage(item)}>{stageLabel(item)}</button>)}</div>
      {stage === 'GROUP' && <PredictedGroupTables outcomes={groupOutcomes} teamsById={teamsById} resolutions={tieResolutions} onResolve={(issue, selectedTeamId) => selectedTeamId && setTieResolutions((current: any[]) => upsertTieResolution(current, issue.groupId, [selectedTeamId, ...issue.teamIds.filter((id) => id !== selectedTeamId)]))} />}
      <div className="match-list">
        {groupedMatches.map(([heading, sectionMatches]) => (
          <section className="match-section" key={heading}>
            <h2>{heading}</h2>
            {sectionMatches.map((match: Match) => <MatchCard key={match.id} match={match} teams={state.teams} teamsById={teamsById} value={draft[match.id]} disabled={locked} onChange={(value) => updateMatch(match.id, value)} />)}
          </section>
        ))}
      </div>
      <div className="sticky-actions">
        <button disabled={locked} onClick={() => onSave(Object.values(draft), tieResolutions)}>Salvesta mustand</button>
        <button disabled={locked || !isComplete(draft, state.matches) || groupOutcomes.unresolvedTies.length > 0 || bonusMissing > 0} onClick={onFinalSubmit}>Kinnita lõplik ennustus</button>
      </div>
    </section>
  );
}

interface CompletionLine {
  key: string;
  label: string;
  value: string;
  missing: number;
  stage?: string;
}

function CompletionSummary({ completion, setStage }: { completion: { percent: number; message: string; lines: CompletionLine[] }; setStage: (stage: string) => void }) {
  return (
    <div className={completion.percent === 100 ? 'data-status official completion-summary' : 'data-status warning completion-summary'}>
      <strong>Ennustuse valmidus: {completion.percent}%</strong>
      <div className="completion-lines">
        {completion.lines.map((line) => (
          <button key={line.key} type="button" className={line.missing ? 'ghost' : 'ghost completion-ok'} onClick={() => line.stage && setStage(line.stage)}>
            <span>{line.label}</span>
            <strong>{line.value}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function PredictedGroupTables({ outcomes, teamsById, resolutions, onResolve }: { outcomes: any; teamsById: Map<string, Team>; resolutions: any[]; onResolve: (issue: GroupTieIssue, selectedTeamId: string) => void }) {
  return (
    <div className="panel group-standings-panel">
      <h2>Minu alagrupitabelid</h2>
      <p className="muted">Alagrupi võitja, teine koht ja edasipääsejad arvutatakse sinu mänguskooridest. Playoffi riigivalikud jäävad endiselt sõltumatuks.</p>
      {outcomes.unresolvedTies.length > 0 && (
        <div className="warning-box">
          <strong>Võrdne seis vajab otsust</strong>
          <p>Sinu ennustuse järgi on mõni tabelikoht veel lahendamata. Vali, kumb lõpetab kõrgemal.</p>
          {outcomes.unresolvedTies.map((issue: GroupTieIssue) => (
            <label key={`${issue.groupId}:${issue.teamIds.join('-')}`}>
              {issue.groupId === 'THIRD_PLACE' ? 'Parimate kolmandate järjestus' : `Alagrupp ${issue.groupId}`}
              <select value={(resolutions.find((item) => item.groupId === issue.groupId)?.teamOrder ?? [])[0] ?? ''} onChange={(event) => onResolve(issue, event.target.value)}>
                <option value="">Vali kõrgemal lõpetav riik</option>
                {issue.teamIds.map((teamId) => <option key={teamId} value={teamId}>{teamNameEt(teamsById.get(teamId))}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}
      <div className="derived-third-summary">
        <strong>Parimad kolmandad, kes sinu ennustuse järgi edasi pääsevad</strong>
        <div className="participant-progress">
          {outcomes.advancingThirdPlaceTeamIds.length === 8 ? outcomes.advancingThirdPlaceTeamIds.map((teamId: string) => <TeamBadge key={teamId} team={teamsById.get(teamId)} />) : <span className="muted">Selgub pärast alagrupitabelite lahendamist.</span>}
        </div>
      </div>
      <div className="group-standings-grid">
        {outcomes.groups.map((group: any) => (
          <article className="group-standing-card" key={group.groupId}>
            <h3>Alagrupp {group.groupId}</h3>
            <div className="standings-table">
              {group.standings.map((standing: any) => <StandingRow key={standing.teamId} standing={standing} team={teamsById.get(standing.teamId)} />)}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function StandingRow({ standing, team }: { standing: any; team?: Team }) {
  const statusLabel = standing.status === 'advanced' ? 'Edasi' : standing.status === 'third_possible' ? 'Võimalik parim 3. koht' : standing.status === 'unresolved' ? 'Otsus puudu' : 'Väljas';
  return (
    <div className="standing-row">
      <span>{standing.rank ?? '-'}</span>
      <TeamBadge team={team} />
      <span>{standing.points}p</span>
      <span>{standing.goalDifference >= 0 ? `+${standing.goalDifference}` : standing.goalDifference}</span>
      <small>{statusLabel}</small>
    </div>
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
  const validation = isKnockout ? knockoutValidation(value) : [];

  return (
    <article className="match-card">
      <div className="match-meta">
        <span>{groupId ? `Alagrupp ${groupId}` : stageLabel(match.stage)} · Mäng {match.id}</span>
        <span>{match.stage === 'GROUP' ? formatEstoniaKickoffTime(kickoff) : formatMatchDate(kickoff)}</span>
      </div>
      {isKnockout && <div className="slot-helper"><span>{helperHome}</span><span>{helperAway}</span></div>}
      {isKnockout && teams && (
        <div className="knockout-team-selects">
          <CountryPicker label="Kodumeeskond" teams={teams} value={value.homeTeamPredictionId} disabled={disabled} onChange={(teamId) => onChange({ ...value, homeTeamPredictionId: teamId, penaltyWinner: clearPenaltyIfMissingSide({ ...value, homeTeamPredictionId: teamId }) })} />
          <CountryPicker label="Võõrsilmeeskond" teams={teams} value={value.awayTeamPredictionId} disabled={disabled} onChange={(teamId) => onChange({ ...value, awayTeamPredictionId: teamId, penaltyWinner: clearPenaltyIfMissingSide({ ...value, awayTeamPredictionId: teamId }) })} />
        </div>
      )}
      <div className="score-row">
        <TeamBadge team={homeTeam} slotLabel={helperHome} />
        <input disabled={disabled} type="number" min="0" value={value.homeGoals} onChange={(event) => onChange({ ...value, homeGoals: Number(event.target.value), penaltyWinner: undefined })} />
        <input disabled={disabled} type="number" min="0" value={value.awayGoals} onChange={(event) => onChange({ ...value, awayGoals: Number(event.target.value), penaltyWinner: undefined })} />
        <TeamBadge team={awayTeam} slotLabel={helperAway} align="right" />
      </div>
      {validation.length > 0 && <div className="field-note missing">{validation[0]}</div>}
      {tiedKnockout && <select disabled={disabled || !value.homeTeamPredictionId || !value.awayTeamPredictionId || value.homeTeamPredictionId === value.awayTeamPredictionId} value={value.penaltyWinner ?? ''} onChange={(event) => onChange({ ...value, penaltyWinner: event.target.value as MatchPrediction['penaltyWinner'] })}>
        <option value="">Penaltiseeria võitja</option><option value="HOME">{homeTeam ? teamNameEt(homeTeam) : helperHome}</option><option value="AWAY">{awayTeam ? teamNameEt(awayTeam) : helperAway}</option>
      </select>}
      {isKnockout && value.predictedWinnerTeamId && <p className="field-note">Edasipääseja selles mängus: {teamNameEt(teamsById.get(value.predictedWinnerTeamId))}</p>}
    </article>
  );
}

function CountryPicker({ label, teams, value, disabled, onChange }: { label: string; teams: Team[]; value?: string; disabled: boolean; onChange: (teamId: string | undefined) => void }) {
  const selected = teams.find((team: any) => team.id === value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const options = useMemo(() => {
    const text = query.trim().toLocaleLowerCase('et-EE');
    const filtered = text ? teams.filter((team: any) => `${teamNameEt(team)} ${team.code}`.toLocaleLowerCase('et-EE').includes(text)) : teams;
    return filtered.slice(0, 14);
  }, [query, teams]);

  return (
    <label className="country-picker">{label}
      <button type="button" className="country-picker-trigger ghost" disabled={disabled} onClick={() => setOpen((current) => !current)}>
        {selected ? <TeamBadge team={selected} /> : <span>Vali riik</span>}
      </button>
      {open && !disabled && (
        <div className="country-picker-menu">
          <input
            value={query}
            autoFocus
            placeholder="Otsi riiki"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false);
              if (event.key === 'Enter' && options[0]) {
                event.preventDefault();
                onChange(options[0].id);
                setOpen(false);
                setQuery('');
              }
            }}
          />
          <div className="country-picker-options">
            {options.map((team: any) => (
              <button key={team.id} type="button" className="country-option ghost" onClick={() => { onChange(team.id); setOpen(false); setQuery(''); }}>
                <TeamBadge team={team} />
              </button>
            ))}
            {options.length === 0 && <p className="muted">Riiki ei leitud.</p>}
          </div>
        </div>
      )}
    </label>
  );
}

// Playoff country selections are independent prediction fields. They make the
// match card understandable, but they are not a bracket tree and are not used
// for match-score points; those remain home/away slot score points.
export function normalizeMatchPrediction(prediction: MatchPrediction): MatchPrediction {
  const next = { ...prediction };
  if (next.homeTeamPredictionId && next.awayTeamPredictionId && next.homeTeamPredictionId === next.awayTeamPredictionId) {
    next.predictedWinnerTeamId = undefined;
    return next;
  }
  if (next.homeGoals > next.awayGoals) next.predictedWinnerTeamId = next.homeTeamPredictionId;
  else if (next.awayGoals > next.homeGoals) next.predictedWinnerTeamId = next.awayTeamPredictionId;
  else if (next.penaltyWinner === 'HOME') next.predictedWinnerTeamId = next.homeTeamPredictionId;
  else if (next.penaltyWinner === 'AWAY') next.predictedWinnerTeamId = next.awayTeamPredictionId;
  else next.predictedWinnerTeamId = undefined;
  return next;
}

function clearPenaltyIfMissingSide(prediction: MatchPrediction): MatchPrediction['penaltyWinner'] {
  if (prediction.penaltyWinner === 'HOME' && !prediction.homeTeamPredictionId) return undefined;
  if (prediction.penaltyWinner === 'AWAY' && !prediction.awayTeamPredictionId) return undefined;
  return prediction.penaltyWinner;
}

export function knockoutValidation(prediction: MatchPrediction): string[] {
  const errors: string[] = [];
  if (!prediction.homeTeamPredictionId) errors.push('Vali selle mängu kodumeeskond.');
  if (!prediction.awayTeamPredictionId) errors.push('Vali selle mängu võõrsilmeeskond.');
  if (prediction.homeTeamPredictionId && prediction.awayTeamPredictionId && prediction.homeTeamPredictionId === prediction.awayTeamPredictionId) errors.push('Samas mängus ei saa mõlemal poolel olla sama riik.');
  if (prediction.homeGoals === prediction.awayGoals && !prediction.penaltyWinner) errors.push('Viigilise tulemuse korral vali penaltiseeria võitja.');
  if (prediction.homeGoals === prediction.awayGoals && prediction.penaltyWinner && !['HOME', 'AWAY'].includes(prediction.penaltyWinner)) errors.push('Penaltiseeria võitja peab olema üks selle mängu riikidest.');
  return errors;
}

export function isComplete(draft: Record<number, MatchPrediction>, matches: any[]): boolean {
  return matches.every((match) => {
    const prediction = draft[match.id];
    if (!prediction || !Number.isInteger(prediction.homeGoals) || !Number.isInteger(prediction.awayGoals)) return false;
    if (match.stage !== 'GROUP') {
      if (knockoutValidation(prediction).length > 0) return false;
      if (!normalizeMatchPrediction(prediction).predictedWinnerTeamId) return false;
    }
    return true;
  });
}

function predictionCompletion(matches: any[], draft: Record<number, MatchPrediction>, unresolvedTieCount: number, bonusMissing: number, player: any, submission: any) {
  const groupMatches = matches.filter((match) => match.stage === 'GROUP');
  const knockoutMatches = matches.filter((match) => match.stage !== 'GROUP');
  const missingGroups = groupMatches.filter((match) => !draft[match.id] || !Number.isInteger(draft[match.id].homeGoals) || !Number.isInteger(draft[match.id].awayGoals)).length;
  const missingKnockout = knockoutMatches.filter((match) => !draft[match.id] || knockoutValidation(draft[match.id]).length > 0 || !normalizeMatchPrediction(draft[match.id]).predictedWinnerTeamId).length;
  const specialRequired = 33;
  const totalRequired = groupMatches.length + knockoutMatches.length + specialRequired + unresolvedTieCount;
  const completedRequired = (groupMatches.length - missingGroups) + (knockoutMatches.length - missingKnockout) + Math.max(0, specialRequired - bonusMissing);
  const percent = totalRequired === 0 ? 0 : Math.max(0, Math.min(100, Math.round((completedRequired / totalRequired) * 100)));
  let message = 'Ennustusi saab muuta';
  if (percent === 100 && submission?.is_final !== 1) message = 'Ennustus on 100% valmis. Kinnita lõplik ennustus.';
  if (submission?.is_final === 1 && player?.status === 'pending') message = 'Ennustus on lõplikult esitatud. Sinu osalus ootab korraldaja kinnitust.';
  if (submission?.is_final === 1 && player?.status === 'approved') message = 'Ennustus kinnitatud. Oled ametlikus arvestuses.';
  if (submission?.is_final === 1 && Object.values(draft).some((prediction: any) => prediction.needs_final_confirmation === 1)) message = 'Oled ennustust muutnud. Kinnita lõplik ennustus uuesti.';
  return {
    percent,
    message,
    lines: [
      { key: 'groups', label: 'Alagrupimängud', value: missingGroups ? `${missingGroups} puudu` : 'valmis', missing: missingGroups, stage: 'GROUP' },
      { key: 'knockout', label: 'Playoff-mängud', value: missingKnockout ? `${missingKnockout} valikut puudu` : 'valmis', missing: missingKnockout, stage: 'R32' },
      { key: 'bonus', label: 'Eriennustused', value: bonusMissing ? `${bonusMissing} valikut puudu` : 'valmis', missing: bonusMissing },
      { key: 'ties', label: 'Võrdsete seisude otsused', value: unresolvedTieCount ? `${unresolvedTieCount} puudu` : 'valmis', missing: unresolvedTieCount, stage: 'GROUP' }
    ]
  };
}

function upsertTieResolution(current: any[], groupId: string, teamOrder: string[]) {
  return [...current.filter((item) => item.groupId !== groupId), { groupId, teamOrder }];
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
