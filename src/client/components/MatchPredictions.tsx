import { useState } from 'react';
import type { Match, MatchPrediction } from '../../domain/types.js';

export function MatchPredictions({ state, locked, saving, onSave }: { state: any; locked: boolean; saving: string; onSave: (predictions: MatchPrediction[]) => void }) {
  const existing = new Map(state.predictions.map((row: any) => [Number(row.match_id), row]));
  const [stage, setStage] = useState('GROUP');
  const [draft, setDraft] = useState<Record<number, MatchPrediction>>(() => Object.fromEntries(state.matches.map((match: Match) => [match.id, {
    matchId: match.id,
    homeGoals: Number(existing.get(match.id)?.home_goals ?? 0),
    awayGoals: Number(existing.get(match.id)?.away_goals ?? 0),
    penaltyWinner: existing.get(match.id)?.penalty_winner ?? undefined
  }])));
  const matches = state.matches.filter((match: Match) => match.stage === stage);
  const completed = Object.values(draft).filter((prediction) => Number.isInteger(prediction.homeGoals) && Number.isInteger(prediction.awayGoals)).length;

  return (
    <section>
      <div className="summary">
        <strong>{completed}/104</strong>
        <span>{locked ? 'Predictions locked' : saving || 'Ready to edit'}</span>
      </div>
      <div className="filters">{['GROUP', 'R32', 'R16', 'QF', 'SF', 'THIRD_PLACE', 'FINAL'].map((item) => <button key={item} className={stage === item ? 'active' : ''} onClick={() => setStage(item)}>{item}</button>)}</div>
      <div className="match-list">{matches.map((match: Match) => <MatchCard key={match.id} match={match} value={draft[match.id]} disabled={locked} onChange={(value) => setDraft((current) => ({ ...current, [match.id]: value }))} />)}</div>
      <button className="sticky-save" disabled={locked} onClick={() => onSave(Object.values(draft))}>Save predictions</button>
    </section>
  );
}

export function MatchCard({ match, value, disabled, onChange }: { match: Match; value: MatchPrediction; disabled: boolean; onChange: (value: MatchPrediction) => void }) {
  const tiedKnockout = match.stage !== 'GROUP' && Number(value.homeGoals) === Number(value.awayGoals);
  return (
    <article className="match-card">
      <div className="match-meta"><span>#{match.id}</span><span>{new Date(match.kickoffAt).toLocaleDateString()}</span></div>
      <div className="score-row">
        <span>{match.homeSlot}</span>
        <input disabled={disabled} type="number" min="0" value={value.homeGoals} onChange={(event) => onChange({ ...value, homeGoals: Number(event.target.value) })} />
        <input disabled={disabled} type="number" min="0" value={value.awayGoals} onChange={(event) => onChange({ ...value, awayGoals: Number(event.target.value) })} />
        <span>{match.awaySlot}</span>
      </div>
      {tiedKnockout && <select disabled={disabled} value={value.penaltyWinner ?? ''} onChange={(event) => onChange({ ...value, penaltyWinner: event.target.value as MatchPrediction['penaltyWinner'] })}>
        <option value="">Penalty winner</option><option value="HOME">{match.homeSlot}</option><option value="AWAY">{match.awaySlot}</option>
      </select>}
    </article>
  );
}
