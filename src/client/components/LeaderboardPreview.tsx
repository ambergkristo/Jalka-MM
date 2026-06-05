import type { LeaderboardRow } from '../data/mock.js';

export function LeaderboardPreview({ rows }: { rows: LeaderboardRow[] }) {
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
        {rows.map((row) => (
          <a className="leaderboard-preview-row" href={`/player/${row.playerId}`} key={row.playerId}>
            <b>{row.rank}</b>
            <span>{row.player}</span>
            <strong>{row.points}</strong>
          </a>
        ))}
      </div>
    </section>
  );
}
