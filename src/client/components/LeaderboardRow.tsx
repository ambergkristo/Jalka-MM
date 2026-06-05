import type { LeaderboardRowView } from '../lib/predictionViewModels.js';
import { PositionChange } from './PositionChange.js';

export function LeaderboardRow({ row }: { row: LeaderboardRowView }) {
  return (
    <a className={`leaderboard-row rank-${row.rank <= 3 ? row.rank : 'standard'}`} href={`/player/${row.playerId}`}>
      <span className="leaderboard-rank">{row.rank}</span>
      <span className="leaderboard-player">
        <strong>{row.player}</strong>
        <PositionChange value={row.positionChange} />
      </span>
      <strong className="leaderboard-points">{row.points}</strong>
      <span>{row.exactScores}</span>
      <span>{row.hitRate}</span>
    </a>
  );
}
