import { useEffect, useState } from 'react';
import { AdminPanel } from './components/AdminPanel.js';
import { BonusPredictionPanel } from './components/BonusPredictionPanel.js';
import { Leaderboard } from './components/Leaderboard.js';
import { MatchPredictions } from './components/MatchPredictions.js';
import { ScoreDetails } from './components/ScoreDetails.js';
import { loadState, login, saveBonusPrediction, savePredictions } from './api.js';
import type { GroupBonusPrediction, KnockoutBonusPrediction, MatchPrediction } from '../domain/types.js';
import { et, errorEt } from './lib/messages.js';

export type View = 'predict' | 'bonus' | 'leaderboard' | 'details' | 'admin';

export function App() {
  const [player, setPlayer] = useState(() => JSON.parse(localStorage.getItem('wc-player') ?? 'null'));
  const [state, setState] = useState<any>(null);
  const [view, setView] = useState<View>('predict');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState('');

  useEffect(() => {
    loadState(player?.id).then(setState).catch((err) => setError(errorEt(err.message)));
  }, [player?.id]);

  async function signIn(form: FormData) {
    setError('');
    const next = await login(String(form.get('name')), String(form.get('inviteCode')), String(form.get('contact') ?? ''));
    localStorage.setItem('wc-player', JSON.stringify(next));
    setPlayer(next);
  }

  async function refresh(nextState?: any) {
    setState(nextState ?? await loadState(player?.id));
  }

  async function saveMatches(predictions: MatchPrediction[]) {
    setSaving('Salvestan ennustusi...');
    try {
      await refresh(await savePredictions(player.id, predictions));
      setSaving('Salvestatud');
    } catch (err) {
      setError(errorEt((err as Error).message));
    } finally {
      setTimeout(() => setSaving(''), 1200);
    }
  }

  async function saveBonuses(groups: GroupBonusPrediction[], knockout: KnockoutBonusPrediction) {
    setSaving('Salvestan boonusennustusi...');
    try {
      await refresh(await saveBonusPrediction(player.id, groups, knockout));
      setSaving('Salvestatud');
    } catch (err) {
      setError(errorEt((err as Error).message));
    } finally {
      setTimeout(() => setSaving(''), 1200);
    }
  }

  if (!player) return <LoginScreen error={error} onSubmit={(event) => { event.preventDefault(); signIn(new FormData(event.currentTarget)).catch((err) => setError(errorEt(err.message))); }} />;
  if (!state) return <Shell player={player} view={view} setView={setView}><div className="empty">Laen turniiriandmeid...</div></Shell>;

  const locked = state.competition.predictions_locked === 1 || Date.now() > new Date(state.competition.prediction_deadline).getTime();

  return (
    <Shell player={player} view={view} setView={setView}>
      {error && <div className="error">{error}</div>}
      {state.currentPlayer?.status === 'pending' && <div className="warning-box">{et.playerStatus.pending}</div>}
      {state.currentPlayer?.status === 'disabled' && <div className="error">{et.playerStatus.disabled}</div>}
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
        <p className="eyebrow">Privaatne sõprade liiga</p>
        <h1>MM 2026 ennustused</h1>
        <form onSubmit={onSubmit}>
          <label>Nimi<input name="name" required placeholder="Sinu nimi" /></label>
          <label>Kontakt, valikuline<input name="contact" placeholder="E-post või telefon" /></label>
          <label>Kutse kood või halduri PIN<input name="inviteCode" required placeholder="FRIENDS2026" /></label>
          <p className="form-note">Osalustasu makstakse väljaspool rakendust isikliku ülekandega korraldajale. Kaardi-, panga- ega makseandmeid siin ei koguta.</p>
          <button>Sisene liigasse</button>
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
        <div><p className="eyebrow">MM 2026 liiga</p><h1>Ennustused</h1></div>
        <span>{player.name}</span>
      </header>
      <nav>{(['predict', 'bonus', 'leaderboard', 'details', ...(player.role === 'admin' ? ['admin'] : [])] as View[]).map((item) => <button key={item} className={view === item ? 'active' : ''} onClick={() => setView(item)}>{navLabel(item)}</button>)}</nav>
      {children}
    </div>
  );
}

function navLabel(view: View) {
  return et.nav[view];
}
