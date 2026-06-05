import type { LeaderboardRowView } from '../lib/predictionViewModels.js';

export function LeaderboardPreview({ rows }: { rows: LeaderboardRowView[] }) {
  return (
    <section className="leaderboard-preview">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Prediction league</p>
          <h2>Top 5 Leaderboard</h2>
        </div>
        <a className="small-action" href="/leaderboard">View Full Leaderboard</a>
      </div>
      <div className="leaderboard-stack">
        {rows.length === 0 ? (
          <p className="empty-state">Leaderboard seed data is not available yet.</p>
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
    </section>
  );
}
