import type { ReactNode } from 'react';
import { Navigation } from './Navigation.js';

export function Layout({ pathname, children }: { pathname: string; children: ReactNode }) {
  return (
    <div className="app-frame">
      <div className="stadium-grid" aria-hidden="true" />
      <div className="topbar">
        <a className="brand" href="/">
          <span>MM 2026</span>
          <strong>Prediction Tracker</strong>
        </a>
        <Navigation pathname={pathname} />
      </div>
      <main>{children}</main>
    </div>
  );
}
