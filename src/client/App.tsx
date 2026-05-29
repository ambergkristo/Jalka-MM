import { useEffect, useMemo, useState } from 'react';
import type { Match, MatchPrediction } from '../domain/types.js';
import { loadState, login, recalculate, savePredictions, saveResult, setLock } from './api.js';

type View = 'predict' | 'leaderboard' | 'admin';

export function App() {
  const [player, setPlayer] = useState(() => JSON.parse(localStorage.getItem('wc-player') ?? 'null'));
  const [state, setState] = useState<any>(null);
  const [view, setView] = useState<View>('predict');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');

  useEffect(() => { loadState(player?.id).then(setState).catch((err) => setError(err.message)); }, [player?.id]);

  async function signIn(form: FormData) {
    const next = await login(String(form.get('name')), String(form.get('inviteCode')));
    localStorage.setItem('wc-player', JSON.stringify(next));
    setPlayer(next);
  }

  async function refresh(nextState?: any) { setState(nextState ?? await loadState(player?.id)); }

  if (!player) return <LoginScreen error={error} onSubmit={(event) => { event.preventDefault(); signIn(new FormData(event.currentTarget)).catch((err) => setError(err.message)); }} />;
  if (!state) return <Shell player={player} view={view} setView={setView}><div className="empty">Loading tournament data...</div></Shell>;

  const locked = state.competition.predictions_locked === 1;
  return (
    <Shell player={player} view={view} setView={setView}>
      {error && <div className="error">{error}</div>}
      {view === 'predict' && <Predictions state={state} locked={locked} saving={saving} onSave={async (predictions) => {
        setSaving('Saving predictions...');
        try { await refresh(await savePredictions(player.id, predictions)); } catch (err) { setError((err as Error).message); } finally { setSaving('Saved'); setTimeout(() => setSaving(''), 1200); }
      }} />}
      {view === 'leaderboard' && <Leaderboard state={state} />}
      {view === 'admin' && <Admin state={state} player={player} onRefresh={refresh} onError={setError} />}
    </Shell>
  );
}

function LoginScreen({ error, onSubmit }: { error: string; onSubmit: React.FormEventHandler<HTMLFormElement> }) {
  return <main className="login"><section className="login-panel"><p className="eyebrow">Private friends league</p><h1>World Cup 2026 predictions</h1><form onSubmit={onSubmit}><label>Name<input name="name" required placeholder="Your name" /></label><label>Invite code or PIN<input name="inviteCode" required placeholder="FRIENDS2026" /></label><button>Enter league</button></form>{error && <div className="error">{error}</div>}</section></main>;
}

function Shell({ player, view, setView, children }: { player: any; view: View; setView: (view: View) => void; children: React.ReactNode }) {
  return <div className="app-shell"><header><div><p className="eyebrow">WC 2026 League</p><h1>Predictions</h1></div><span>{player.name}</span></header><nav>{(['predict', 'leaderboard', 'admin'] as View[]).map((item) => <button key={item} className={view === item ? 'active' : ''} onClick={() => setView(item)}>{item}</button>)}</nav>{children}</div>;
}

function Predictions({ state, locked, saving, onSave }: { state: any; locked: boolean; saving: string; onSave: (predictions: MatchPrediction[]) => void }) {
  const existing = new Map(state.predictions.map((row: any) => [Number(row.match_id), row]));
  const [stage, setStage] = useState('GROUP');
  const [draft, setDraft] = useState<Record<number, MatchPrediction>>(() => Object.fromEntries(state.matches.map((match: any) => [match.id, { matchId: match.id, homeGoals: Number(existing.get(match.id)?.home_goals ?? 0), awayGoals: Number(existing.get(match.id)?.away_goals ?? 0), penaltyWinner: existing.get(match.id)?.penalty_winner ?? undefined }])));
  const matches = state.matches.filter((match: Match) => match.stage === stage);
  const completed = Object.values(draft).filter((prediction) => Number.isInteger(prediction.homeGoals) && Number.isInteger(prediction.awayGoals)).length;
  return <section><div className="summary"><strong>{completed}/104</strong><span>{locked ? 'Predictions locked' : saving || 'Ready to edit'}</span></div><div className="filters">{['GROUP', 'R32', 'R16', 'QF', 'SF', 'THIRD_PLACE', 'FINAL'].map((item) => <button key={item} className={stage === item ? 'active' : ''} onClick={() => setStage(item)}>{item}</button>)}</div><div className="match-list">{matches.map((match: Match) => <MatchCard key={match.id} match={match} value={draft[match.id]} disabled={locked} onChange={(value) => setDraft((current) => ({ ...current, [match.id]: value }))} />)}</div><button className="sticky-save" disabled={locked} onClick={() => onSave(Object.values(draft))}>Save predictions</button></section>;
}

function MatchCard({ match, value, disabled, onChange }: { match: Match; value: MatchPrediction; disabled: boolean; onChange: (value: MatchPrediction) => void }) {
  const tiedKnockout = match.stage !== 'GROUP' && Number(value.homeGoals) === Number(value.awayGoals);
  return <article className="match-card"><div className="match-meta"><span>#{match.id}</span><span>{new Date(match.kickoffAt).toLocaleDateString()}</span></div><div className="score-row"><span>{match.homeSlot}</span><input disabled={disabled} type="number" min="0" value={value.homeGoals} onChange={(event) => onChange({ ...value, homeGoals: Number(event.target.value) })} /><input disabled={disabled} type="number" min="0" value={value.awayGoals} onChange={(event) => onChange({ ...value, awayGoals: Number(event.target.value) })} /><span>{match.awaySlot}</span></div>{tiedKnockout && <select disabled={disabled} value={value.penaltyWinner ?? ''} onChange={(event) => onChange({ ...value, penaltyWinner: event.target.value as MatchPrediction['penaltyWinner'] })}><option value="">Penalty winner</option><option value="HOME">{match.homeSlot}</option><option value="AWAY">{match.awaySlot}</option></select>}</article>;
}

function Leaderboard({ state }: { state: any }) {
  const leader = state.leaderboard[0];
  return <section><div className="summary"><strong>{leader?.name ?? 'No leader yet'}</strong><span>Last updated {new Date(state.lastUpdated).toLocaleTimeString()}</span></div><div className="leaderboard">{state.leaderboard.map((row: any, index: number) => <article key={row.playerId} className="leader-row"><b>{index + 1}</b><span>{row.name}</span><span>{row.matchPoints} match</span><span>{row.bonusPoints} bonus</span><strong>{row.totalPoints}</strong>{row.previousRank && row.previousRank !== index + 1 && <small>{row.previousRank > index + 1 ? 'up' : 'down'} from {row.previousRank}</small>}</article>)}</div></section>;
}

function Admin({ state, player, onRefresh, onError }: { state: any; player: any; onRefresh: (state?: any) => void; onError: (message: string) => void }) {
  const [matchId, setMatchId] = useState(1);
  const match = useMemo(() => state.matches.find((item: Match) => item.id === matchId), [state.matches, matchId]);
  const [result, setResult] = useState<MatchPrediction>({ matchId: 1, homeGoals: 0, awayGoals: 0 });
  return <section className="admin-grid"><div className="panel"><h2>Result entry</h2><select value={matchId} onChange={(event) => { const next = Number(event.target.value); setMatchId(next); setResult({ matchId: next, homeGoals: 0, awayGoals: 0 }); }}>{state.matches.map((item: Match) => <option key={item.id} value={item.id}>#{item.id} {item.homeSlot} v {item.awaySlot}</option>)}</select>{match && <MatchCard match={match} value={result} disabled={false} onChange={setResult} />}<button onClick={() => saveResult(player.name, result).then(onRefresh).catch((err) => onError(err.message))}>Save result</button></div><div className="panel"><h2>Controls</h2><button onClick={() => setLock(player.name, true).then(onRefresh).catch((err) => onError(err.message))}>Lock predictions</button><button onClick={() => setLock(player.name, false).then(onRefresh).catch((err) => onError(err.message))}>Unlock predictions</button><button onClick={() => recalculate().then(() => onRefresh()).catch((err) => onError(err.message))}>Recalculate all scores</button></div></section>;
}
