import type { ReactNode } from 'react';
import type { CountyLeaderboardRow } from '../../domain/countyLeaderboard.js';
import type { TournamentTopScorer } from '../data/mock.js';
import type { LeaderboardRowView } from '../lib/predictionViewModels.js';

export function LeaderboardPreview({
  rows,
  topScorers = [],
  countyRows = []
}: {
  rows: LeaderboardRowView[];
  topScorers?: TournamentTopScorer[];
  countyRows?: CountyLeaderboardRow[];
}) {
  return (
    <section className="leaderboard-preview">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Ennustusliiga</p>
          <h2>Hetke edetabelid</h2>
        </div>
        <a className="small-action" href="/leaderboard">
          Vaata kogu edetabelit
        </a>
      </div>

      <div className="leaderboard-preview-grid">
        <PreviewPanel eyebrow="Mängijad" title="Top 5">
          <div className="leaderboard-stack">
            {rows.length === 0 ? (
              <p className="empty-state">Edetabeli andmeid pole veel saadaval.</p>
            ) : (
              rows.map((row) => (
                <a className="leaderboard-preview-row" href={`/player/${row.playerId}`} key={row.playerId}>
                  <b>{row.rank}</b>
                  <span>{row.player}</span>
                  <strong>{row.points}</strong>
                </a>
              ))
            )}
          </div>
        </PreviewPanel>

        <PreviewPanel eyebrow="Väravalööjad" title="Top 3">
          <div className="leaderboard-stack">
            {topScorers.length === 0 ? (
              <p className="empty-state">Väravalööjate info ei ole veel saadaval.</p>
            ) : (
              topScorers.map((scorer) => (
                <div className="leaderboard-preview-row compact" key={`${scorer.rank}-${scorer.player}`}>
                  <b>{scorer.rank}</b>
                  <span>
                    {scorer.player}
                    <small>{scorer.team}</small>
                  </span>
                  <strong>{scorer.goals}</strong>
                </div>
              ))
            )}
          </div>
        </PreviewPanel>

        <PreviewPanel eyebrow="Maakonnad" title="Top 3">
          <div className="leaderboard-stack">
            {countyRows.length === 0 ? (
              <p className="empty-state">Andmed puuduvad</p>
            ) : (
              countyRows.map((county) => (
                <div className="leaderboard-preview-row compact" key={county.county}>
                  <b>{county.rank}</b>
                  <span>
                    {county.county}
                    <small>
                      {county.playerCount} mängijat · top 3 arvestus
                    </small>
                  </span>
                  <strong>{county.totalPoints}</strong>
                </div>
              ))
            )}
          </div>
        </PreviewPanel>
      </div>
    </section>
  );
}

function PreviewPanel({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="leaderboard-preview-panel">
      <div className="leaderboard-preview-panel-title">
        <span>{eyebrow}</span>
        <strong>{title}</strong>
      </div>
      {children}
    </div>
  );
}
