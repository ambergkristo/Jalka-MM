import { useEffect, useMemo, useState } from 'react';
import { AdminPanel } from './components/AdminPanel.js';
import { BonusPredictionPanel } from './components/BonusPredictionPanel.js';
import { LandingPage } from './components/LandingPage.js';
import { Leaderboard } from './components/Leaderboard.js';
import { MatchPredictions } from './components/MatchPredictions.js';
import { ResultsOverview } from './components/ResultsOverview.js';
import { RulesView } from './components/RulesView.js';
import { ScoreDetails } from './components/ScoreDetails.js';
import { adminLogin, currentSession, finalSubmitPredictions, loadState, login, logoutSession, register, saveBonusPrediction, savePredictions } from './api.js';
import type { GroupBonusPrediction, GroupTieResolution, KnockoutBonusPrediction, MatchPrediction } from '../domain/types.js';
import { defaultPlayerView, deriveCompetitionState, type PlayerView } from './lib/competitionState.js';
import { et, errorEt } from './lib/messages.js';

type Screen = 'landing' | 'login' | 'app' | 'rules';
export type View = PlayerView;

export function App() {
  const [player, setPlayer] = useState<any>(null);
  const [state, setState] = useState<any>(null);
  const [screen, setScreen] = useState<Screen>('landing');
  const [view, setView] = useState<View>('predict');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState('');

  useEffect(() => {
    Promise.all([currentSession().catch(() => null), loadState()]).then(([session, loadedState]) => {
      setPlayer(session);
      setState(loadedState);
    }).catch((err) => setError(errorEt(err.message)));
  }, []);

  const competitionState = useMemo(() => deriveCompetitionState(state), [state]);
  const locked = state ? state.competition.predictions_locked === 1 || Date.now() > new Date(state.competition.prediction_deadline).getTime() : false;

  async function signIn(form: FormData) {
    setError('');
    const mode = String(form.get('mode') ?? 'login');
    const password = String(form.get('password') ?? '');
    if (mode === 'register' && password !== String(form.get('repeatPassword') ?? '')) throw new Error('Paroolid ei kattu');
    const next = mode === 'admin'
      ? await adminLogin(String(form.get('username') ?? ''), password)
      : mode === 'register'
        ? await register(String(form.get('firstName') ?? ''), String(form.get('lastName') ?? ''), String(form.get('contact') ?? ''), String(form.get('inviteCode') ?? ''), password)
        : await login(String(form.get('firstName') ?? ''), String(form.get('lastName') ?? ''), password);
    setPlayer(next);
    const nextState = await loadState();
    setState(nextState);
    setView(next.role === 'admin' ? 'admin' : defaultPlayerView(deriveCompetitionState(nextState)));
    setScreen('app');
  }

  async function refresh(nextState?: any) {
    setState(nextState ?? await loadState());
  }

  async function saveMatches(predictions: MatchPrediction[], tieResolutions: GroupTieResolution[] = []) {
    setSaving('Salvestan mustandit...');
    try {
      await refresh(await savePredictions(predictions, tieResolutions));
      setSaving('Mustand salvestatud');
    } catch (err) {
      setError(errorEt((err as Error).message));
    } finally {
      setTimeout(() => setSaving(''), 1200);
    }
  }

  async function saveBonuses(groups: GroupBonusPrediction[], knockout: KnockoutBonusPrediction) {
    setSaving('Salvestan eriennustusi...');
    try {
      await refresh(await saveBonusPrediction(groups, knockout));
      setSaving('Mustand salvestatud');
    } catch (err) {
      setError(errorEt((err as Error).message));
    } finally {
      setTimeout(() => setSaving(''), 1200);
    }
  }

  async function submitFinal() {
    setSaving('Kinnitan lõplikku ennustust...');
    try {
      await refresh(await finalSubmitPredictions());
      setSaving('Lõplik ennustus kinnitatud');
    } catch (err) {
      setError(errorEt((err as Error).message));
    } finally {
      setTimeout(() => setSaving(''), 1600);
    }
  }

  function enterPrimaryFlow() {
    if (!player) {
      setScreen('login');
      return;
    }
    setView(player.role === 'admin' ? 'admin' : defaultPlayerView(competitionState));
    setScreen('app');
  }

  function logout() {
    logoutSession().finally(() => {
      setPlayer(null);
      setSelectedPlayerId('');
      setView('predict');
      setScreen('landing');
      loadState().then(setState).catch((err) => setError(errorEt(err.message)));
    });
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
      {view === 'predict' && <MatchPredictions state={state} locked={locked} saving={saving} onSave={saveMatches} onFinalSubmit={submitFinal} />}
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
  const [mode, setMode] = useState<'login' | 'register' | 'admin'>('login');
  return (
    <main className="login">
      <section className="login-panel">
        <p className="eyebrow">Privaatne sõprade liiga</p>
        <h1>MM 2026 ennustused</h1>
        <div className="filters auth-tabs">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Logi sisse</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Registreeru</button>
          <button type="button" className={mode === 'admin' ? 'active' : ''} onClick={() => setMode('admin')}>Korraldajale</button>
        </div>
        <form onSubmit={onSubmit}>
          <input type="hidden" name="mode" value={mode} />
          {mode === 'admin' ? (
            <>
              <label>Kasutajanimi<input name="username" required placeholder="Kristo või Argo" /></label>
              <label>Parool<input name="password" required type="password" /></label>
            </>
          ) : (
            <>
              <label>Eesnimi<input name="firstName" required placeholder="Eesnimi" /></label>
              <label>Perekonnanimi<input name="lastName" required placeholder="Perekonnanimi" /></label>
              {mode === 'register' && <label>Kontakt, soovi korral<input name="contact" placeholder="E-post või telefon" /></label>}
              {mode === 'register' && <label>Liiga kutsekood<input name="inviteCode" required placeholder="FRIENDS2026" /></label>}
              <label>Isiklik parool<input name="password" required type="password" minLength={6} /></label>
              {mode === 'register' && <label>Korda parooli<input name="repeatPassword" required type="password" minLength={6} /></label>}
              <p className="form-note">Osalustasu makstakse väljaspool rakendust isikliku ülekandega korraldajale. Ametlikku arvestusse pääsed pärast korraldaja kinnitust. Isiklik parool on vajalik hilisemaks sisselogimiseks.</p>
            </>
          )}
          <button>{mode === 'register' ? 'Registreeru' : 'Logi sisse'}</button>
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
        <div className="player-menu"><span>{player?.name}</span><button className="ghost" onClick={onLogout}>Logi välja</button></div>
      </header>
      <nav>{views.map((item) => <button key={item} className={view === item ? 'active' : ''} onClick={() => item === 'rules' ? onRules() : setView(item)}>{navLabel(item)}</button>)}</nav>
      {children}
    </div>
  );
}

function navLabel(view: View) {
  return et.nav[view];
}
