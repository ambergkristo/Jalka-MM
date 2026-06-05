import type { LeaderboardRowView } from '../lib/predictionViewModels.js';
import { LeaderboardRow } from './LeaderboardRow.js';

export function LeaderboardTable({ rows }: { rows: LeaderboardRowView[] }) {
  if (rows.length === 0) {
    return <p className="empty-state">Leaderboard seed data is not available yet.</p>;
  }

  return (
    <section className="leaderboard-table" aria-label="Prediction league standings">
      <div className="leaderboard-table-head" aria-hidden="true">
        <span>Rank</span>
        <span>Player</span>
        <span>Points</span>
        <span>Exact Scores</span>
        <span>Hit Rate</span>
      </div>
      <div className="leaderboard-table-body">
        {rows.map((row) => <LeaderboardRow row={row} key={row.playerId} />)}
      </div>
    </section>
  );
}
