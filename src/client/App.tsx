import { useEffect, useMemo, useState } from 'react';
import { Layout } from './components/Layout.js';
import { loadPublicState, type PublicState } from './api.js';
import { LandingDashboard } from './pages/LandingDashboard.js';
import { LeaderboardPage } from './pages/LeaderboardPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { PlayerDetailPage } from './pages/PlayerDetailPage.js';
import { ResultsPage } from './pages/ResultsPage.js';
import { TournamentPage } from './pages/TournamentPage.js';

export function App() {
  const pathname = normalizePath(window.location.pathname);
  const route = useMemo(() => matchRoute(pathname), [pathname]);
  const [state, setState] = useState<PublicState | null>(null);

  useEffect(() => {
    loadPublicState().then(setState).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (route.name === 'not-found' && pathname !== '/not-found') {
      window.history.replaceState(null, '', '/not-found');
    }
  }, [pathname, route.name]);

  return (
    <Layout pathname={route.name === 'not-found' ? '/not-found' : pathname}>
      {state && <div className="status-strip">Data status: {state.tournamentDataStatus} - API {state.status}</div>}
      {route.name === 'dashboard' && <LandingDashboard />}
      {route.name === 'leaderboard' && <LeaderboardPage />}
      {route.name === 'player' && <PlayerDetailPage playerId={route.playerId} />}
      {route.name === 'results' && <ResultsPage />}
      {route.name === 'tournament' && <TournamentPage />}
      {route.name === 'not-found' && <NotFoundPage />}
    </Layout>
  );
}

type Route =
  | { name: 'dashboard' }
  | { name: 'leaderboard' }
  | { name: 'player'; playerId: string }
  | { name: 'results' }
  | { name: 'tournament' }
  | { name: 'not-found' };

function matchRoute(pathname: string): Route {
  if (pathname === '/') return { name: 'dashboard' };
  if (pathname === '/leaderboard') return { name: 'leaderboard' };
  if (pathname === '/results') return { name: 'results' };
  if (pathname === '/tournament') return { name: 'tournament' };
  if (pathname === '/not-found') return { name: 'not-found' };
  const playerMatch = pathname.match(/^\/player\/([^/]+)$/);
  if (playerMatch) return { name: 'player', playerId: decodeURIComponent(playerMatch[1]) };
  return { name: 'not-found' };
}

function normalizePath(pathname: string) {
  if (!pathname || pathname === '') return '/';
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}
