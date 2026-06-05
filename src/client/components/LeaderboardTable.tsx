import type { LeaderboardRow as LeaderboardRowData } from '../data/mock.js';
import { LeaderboardRow } from './LeaderboardRow.js';

export function LeaderboardTable({ rows }: { rows: LeaderboardRowData[] }) {
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
