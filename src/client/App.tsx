import { useEffect, useMemo, useState } from 'react';
import { AdminPanel } from './components/AdminPanel.js';
import { BonusPredictionPanel } from './components/BonusPredictionPanel.js';
import { LandingPage } from './components/LandingPage.js';
import { Leaderboard } from './components/Leaderboard.js';
import { MatchPredictions } from './components/MatchPredictions.js';
import { ResultsOverview } from './components/ResultsOverview.js';
import { RulesView } from './components/RulesView.js';
import { ScoreDetails } from './components/ScoreDetails.js';
import { loadState, login, saveBonusPrediction, savePredictions } from './api.js';
import type { GroupBonusPrediction, KnockoutBonusPrediction, MatchPrediction } from '../domain/types.js';
import { defaultPlayerView, deriveCompetitionState, type PlayerView } from './lib/competitionState.js';
import { et, errorEt } from './lib/messages.js';

type Screen = 'landing' | 'login' | 'app' | 'rules';
export type View = PlayerView;

export function App() {
  const [player, setPlayer] = useState(() => JSON.parse(localStorage.getItem('wc-player') ?? 'null'));
  const [state, setState] = useState<any>(null);
  const [screen, setScreen] = useState<Screen>('landing');
  const [view, setView] = useState<View>('predict');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState('');

  useEffect(() => {
    loadState(player?.id).then(setState).catch((err) => setError(errorEt(err.message)));
  }, [player?.id]);

  const competitionState = useMemo(() => deriveCompetitionState(state), [state]);
  const locked = state ? state.competition.predictions_locked === 1 || Date.now() > new Date(state.competition.prediction_deadline).getTime() : false;

  async function signIn(form: FormData) {
    setError('');
    const next = await login(String(form.get('name')), String(form.get('inviteCode')), String(form.get('contact') ?? ''));
    localStorage.setItem('wc-player', JSON.stringify(next));
    setPlayer(next);
    const nextState = await loadState(next.id);
    setState(nextState);
    setView(defaultPlayerView(deriveCompetitionState(nextState)));
    setScreen('app');
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

  function enterPrimaryFlow() {
    if (!player) {
      setScreen('login');
      return;
    }
    setView(defaultPlayerView(competitionState));
    setScreen('app');
  }

  function logout() {
    localStorage.removeItem('wc-player');
    setPlayer(null);
    setSelectedPlayerId('');
    setView('predict');
    setScreen('landing');
    loadState().then(setState).catch((err) => setError(errorEt(err.message)));
  }

  if (screen === 'rules') return <StandaloneRules onBack={() => setScreen(player ? 'app' : 'landing')} />;
  if (screen === 'login') return <LoginScreen error={error} onBack={() => setScreen('landing')} onSubmit={(event) => { event.preventDefault(); signIn(new FormData(event.currentTarget)).catch((err) => setError(errorEt(err.message))); }} />;
  if (screen === 'landing') return <LandingPage state={state} player={player} competitionState={competitionState} onPrimary={enterPrimaryFlow} onRules={() => setScreen('rules')} />;
  if (!state) return <Shell player={player} view={view} setView={setView} onRules={() => setScreen('rules')} onLogout={logout}><div className="empty">Laen turniiriandmeid...</div></Shell>;

  return (
    <Shell player={player} view={view} setView={setView} onRules={() => setScreen('rules')} onLogout={logout}>
      {error && <div className="error">{error}</div>}
      {state.currentPlayer?.status === 'pending' && <div className="warning-box">{et.playerStatus.pending}</div>}
      {state.currentPlayer?.status === 'disabled' && <div className="error">{et.playerStatus.disabled}</div>}
      {view === 'predict' && <MatchPredictions state={state} locked={locked} saving={saving} onSave={saveMatches} />}
      {view === 'bonus' && <BonusPredictionPanel state={state} locked={locked} saving={saving} onSave={saveBonuses} />}
      {view === 'results' && <ResultsOverview state={state} player={player} onLeaderboard={() => setView('leaderboard')} onDetails={() => setView('details')} onPredictions={() => setView('predict')} />}
      {view === 'leaderboard' && <Leaderboard state={state} onSelect={(playerId) => { setSelectedPlayerId(playerId); setView('details'); }} />}
      {view === 'details' && <ScoreDetails state={state} playerId={selectedPlayerId || player.id} />}
      {view === 'rules' && <RulesView />}
      {view === 'admin' && <AdminPanel state={state} player={player} competitionState={competitionState} onRefresh={refresh} onError={setError} />}
    </Shell>
  );
}

function LoginScreen({ error, onSubmit, onBack }: { error: string; onSubmit: React.FormEventHandler<HTMLFormElement>; onBack: () => void }) {
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
          <button type="button" className="ghost" onClick={onBack}>Tagasi</button>
        </form>
        {error && <div className="error">{error}</div>}
      </section>
    </main>
  );
}

function StandaloneRules({ onBack }: { onBack: () => void }) {
  return <main className="app-shell"><RulesView onBack={onBack} /></main>;
}

function Shell({ player, view, setView, onRules, onLogout, children }: { player: any; view: View; setView: (view: View) => void; onRules: () => void; onLogout: () => void; children: React.ReactNode }) {
  const views = ['predict', 'bonus', 'results', 'leaderboard', 'details', 'rules', ...(player?.role === 'admin' ? ['admin'] : [])] as View[];
  return (
    <div className="app-shell">
      <header>
        <div><p className="eyebrow">MM 2026 liiga</p><h1>{navLabel(view)}</h1></div>
        <div className="player-menu"><span>{player?.name}</span><button className="ghost" onClick={onLogout}>Vaheta kasutajat</button></div>
      </header>
      <nav>{views.map((item) => <button key={item} className={view === item ? 'active' : ''} onClick={() => item === 'rules' ? onRules() : setView(item)}>{navLabel(item)}</button>)}</nav>
      {children}
    </div>
  );
}

function navLabel(view: View) {
  return et.nav[view];
}
