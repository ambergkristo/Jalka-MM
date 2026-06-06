import { useEffect, useMemo } from 'react';
import { Layout } from './components/Layout.js';
import { LandingDashboard } from './pages/LandingDashboard.js';
import { LeaderboardPage } from './pages/LeaderboardPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { OperatorPage } from './pages/OperatorPage.js';
import { PlayerDetailPage } from './pages/PlayerDetailPage.js';
import { ResultsPage } from './pages/ResultsPage.js';
import { TournamentPage } from './pages/TournamentPage.js';

export function App() {
  const pathname = normalizePath(window.location.pathname);
  const route = useMemo(() => matchRoute(pathname), [pathname]);

  useEffect(() => {
    if (route.name === 'not-found' && pathname !== '/not-found') {
      window.history.replaceState(null, '', '/not-found');
    }
  }, [pathname, route.name]);

  return (
    <Layout pathname={route.name === 'not-found' ? '/not-found' : pathname}>
      {route.name === 'dashboard' && <LandingDashboard />}
      {route.name === 'leaderboard' && <LeaderboardPage />}
      {route.name === 'player' && <PlayerDetailPage playerId={route.playerId} />}
      {route.name === 'operator' && <OperatorPage />}
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
  | { name: 'operator' }
  | { name: 'results' }
  | { name: 'tournament' }
  | { name: 'not-found' };

export function matchRoute(pathname: string): Route {
  if (pathname === '/') return { name: 'dashboard' };
  if (pathname === '/leaderboard') return { name: 'leaderboard' };
  if (pathname === '/operator') return { name: 'operator' };
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
