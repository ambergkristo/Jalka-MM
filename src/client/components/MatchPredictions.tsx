import { useState } from 'react';
import type { Match, MatchPrediction, Team } from '../../domain/types.js';
import { formatMatchDate } from '../lib/date.js';
import { UserDataStatus } from './DataStatus.js';
import { TeamBadge } from './TeamBadge.js';

export function MatchPredictions({ state, locked, saving, onSave }: { state: any; locked: boolean; saving: string; onSave: (predictions: MatchPrediction[]) => void }) {
  const existing = new Map(state.predictions.map((row: any) => [Number(row.match_id), row]));
  const [stage, setStage] = useState('GROUP');
  const [draft, setDraft] = useState<Record<number, MatchPrediction>>(() => Object.fromEntries(state.matches.map((match: Match) => [match.id, {
    matchId: match.id,
    homeGoals: Number(existing.get(match.id)?.home_goals ?? 0),
    awayGoals: Number(existing.get(match.id)?.away_goals ?? 0),
    penaltyWinner: existing.get(match.id)?.penalty_winner ?? undefined
  }])));
  const teamsById = new Map(state.teams.map((team: any) => [team.id, team as Team]));
  const matches = state.matches.filter((match: Match) => match.stage === stage);
  const completed = Object.values(draft).filter((prediction) => Number.isInteger(prediction.homeGoals) && Number.isInteger(prediction.awayGoals)).length;
  const groupedMatches = stage === 'GROUP' ? groupMatches(matches) : [[stageLabel(stage), matches]] as Array<[string, Match[]]>;

  return (
    <section>
      <div className="summary">
        <strong>{completed}/104</strong>
        <span>{locked ? 'Predictions locked' : saving || 'Ready to edit'}</span>
      </div>
      <UserDataStatus status={state.tournamentDataStatus} />
      <div className="filters">{['GROUP', 'R32', 'R16', 'QF', 'SF', 'THIRD_PLACE', 'FINAL'].map((item) => <button key={item} className={stage === item ? 'active' : ''} onClick={() => setStage(item)}>{stageLabel(item)}</button>)}</div>
      <div className="match-list">
        {groupedMatches.map(([heading, sectionMatches]) => (
          <section className="match-section" key={heading}>
            <h2>{heading}</h2>
            {sectionMatches.map((match: Match) => <MatchCard key={match.id} match={match} teamsById={teamsById} value={draft[match.id]} disabled={locked} onChange={(value) => setDraft((current) => ({ ...current, [match.id]: value }))} />)}
          </section>
        ))}
      </div>
      <button className="sticky-save" disabled={locked} onClick={() => onSave(Object.values(draft))}>Save predictions</button>
    </section>
  );
}

export function MatchCard({ match, value, disabled, onChange, teamsById = new Map() }: { match: Match | any; value: MatchPrediction; disabled: boolean; onChange: (value: MatchPrediction) => void; teamsById?: Map<string, Team> }) {
  const tiedKnockout = match.stage !== 'GROUP' && Number(value.homeGoals) === Number(value.awayGoals);
  const kickoff = match.kickoffAt ?? match.kickoff_at;
  const homeTeam = match.homeTeamId || match.home_team_id ? teamsById.get(match.homeTeamId ?? match.home_team_id) : null;
  const awayTeam = match.awayTeamId || match.away_team_id ? teamsById.get(match.awayTeamId ?? match.away_team_id) : null;
  return (
    <article className="match-card">
      <div className="match-meta"><span>Match {match.id} · {stageLabel(match.stage)}{match.groupId || match.group_id ? ` · Group ${match.groupId ?? match.group_id}` : ''}</span><span>{formatMatchDate(kickoff)}</span></div>
      <div className="score-row">
        <TeamBadge team={homeTeam} slotLabel={match.homeSlot ?? match.home_slot} />
        <input disabled={disabled} type="number" min="0" value={value.homeGoals} onChange={(event) => onChange({ ...value, homeGoals: Number(event.target.value) })} />
        <input disabled={disabled} type="number" min="0" value={value.awayGoals} onChange={(event) => onChange({ ...value, awayGoals: Number(event.target.value) })} />
        <TeamBadge team={awayTeam} slotLabel={match.awaySlot ?? match.away_slot} align="right" />
      </div>
      {tiedKnockout && <select disabled={disabled} value={value.penaltyWinner ?? ''} onChange={(event) => onChange({ ...value, penaltyWinner: event.target.value as MatchPrediction['penaltyWinner'] })}>
        <option value="">Penalty winner</option><option value="HOME">{match.homeSlot ?? match.home_slot}</option><option value="AWAY">{match.awaySlot ?? match.away_slot}</option>
      </select>}
    </article>
  );
}

function groupMatches(matches: Match[]): Array<[string, Match[]]> {
  const groups = new Map<string, Match[]>();
  for (const match of matches as any[]) {
    const groupId = match.groupId ?? match.group_id ?? 'Other';
    groups.set(groupId, [...(groups.get(groupId) ?? []), match]);
  }
  return [...groups.entries()].map(([groupId, groupMatches]) => [`Group ${groupId}`, groupMatches]);
}

export function stageLabel(stage: string) {
  return ({ GROUP: 'Groups', R32: 'R32', R16: 'R16', QF: 'QF', SF: 'SF', THIRD_PLACE: 'Third place', FINAL: 'Final' } as Record<string, string>)[stage] ?? stage;
}
