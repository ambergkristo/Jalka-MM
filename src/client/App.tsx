import { useEffect, useState } from 'react';
import { AdminPanel } from './components/AdminPanel.js';
import { BonusPredictionPanel } from './components/BonusPredictionPanel.js';
import { Leaderboard } from './components/Leaderboard.js';
import { MatchPredictions } from './components/MatchPredictions.js';
import { ScoreDetails } from './components/ScoreDetails.js';
import { loadState, login, saveBonusPrediction, savePredictions } from './api.js';
import type { GroupBonusPrediction, KnockoutBonusPrediction, MatchPrediction } from '../domain/types.js';

export type View = 'predict' | 'bonus' | 'leaderboard' | 'details' | 'admin';

export function App() {
  const [player, setPlayer] = useState(() => JSON.parse(localStorage.getItem('wc-player') ?? 'null'));
  const [state, setState] = useState<any>(null);
  const [view, setView] = useState<View>('predict');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState('');

  useEffect(() => {
    loadState(player?.id).then(setState).catch((err) => setError(err.message));
  }, [player?.id]);

  async function signIn(form: FormData) {
    setError('');
    const next = await login(String(form.get('name')), String(form.get('inviteCode')));
    localStorage.setItem('wc-player', JSON.stringify(next));
    setPlayer(next);
  }

  async function refresh(nextState?: any) {
    setState(nextState ?? await loadState(player?.id));
  }

  async function saveMatches(predictions: MatchPrediction[]) {
    setSaving('Saving match predictions...');
    try {
      await refresh(await savePredictions(player.id, predictions));
      setSaving('Saved');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTimeout(() => setSaving(''), 1200);
    }
  }

  async function saveBonuses(groups: GroupBonusPrediction[], knockout: KnockoutBonusPrediction) {
    setSaving('Saving bonus predictions...');
    try {
      await refresh(await saveBonusPrediction(player.id, groups, knockout));
      setSaving('Saved');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTimeout(() => setSaving(''), 1200);
    }
  }

  if (!player) return <LoginScreen error={error} onSubmit={(event) => { event.preventDefault(); signIn(new FormData(event.currentTarget)).catch((err) => setError(err.message)); }} />;
  if (!state) return <Shell player={player} view={view} setView={setView}><div className="empty">Loading tournament data...</div></Shell>;

  const locked = state.competition.predictions_locked === 1 || Date.now() > new Date(state.competition.prediction_deadline).getTime();

  return (
    <Shell player={player} view={view} setView={setView}>
      {error && <div className="error">{error}</div>}
      {view === 'predict' && <MatchPredictions state={state} locked={locked} saving={saving} onSave={saveMatches} />}
      {view === 'bonus' && <BonusPredictionPanel state={state} locked={locked} saving={saving} onSave={saveBonuses} />}
      {view === 'leaderboard' && <Leaderboard state={state} onSelect={(playerId) => { setSelectedPlayerId(playerId); setView('details'); }} />}
      {view === 'details' && <ScoreDetails state={state} playerId={selectedPlayerId || player.id} />}
      {view === 'admin' && <AdminPanel state={state} player={player} onRefresh={refresh} onError={setError} />}
    </Shell>
  );
}

function LoginScreen({ error, onSubmit }: { error: string; onSubmit: React.FormEventHandler<HTMLFormElement> }) {
  return (
    <main className="login">
      <section className="login-panel">
        <p className="eyebrow">Private friends league</p>
        <h1>World Cup 2026 predictions</h1>
        <form onSubmit={onSubmit}>
          <label>Name<input name="name" required placeholder="Your name" /></label>
          <label>Invite code or PIN<input name="inviteCode" required placeholder="FRIENDS2026" /></label>
          <button>Enter league</button>
        </form>
        {error && <div className="error">{error}</div>}
      </section>
    </main>
  );
}

function Shell({ player, view, setView, children }: { player: any; view: View; setView: (view: View) => void; children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header>
        <div><p className="eyebrow">WC 2026 League</p><h1>Predictions</h1></div>
        <span>{player.name}</span>
      </header>
      <nav>{(['predict', 'bonus', 'leaderboard', 'details', 'admin'] as View[]).map((item) => <button key={item} className={view === item ? 'active' : ''} onClick={() => setView(item)}>{item}</button>)}</nav>
      {children}
    </div>
  );
}
