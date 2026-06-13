import type { LeaderboardRowView } from '../lib/predictionViewModels.js';
import { LeaderboardRow } from './LeaderboardRow.js';

export function LeaderboardTable({ rows, emptyMessage = 'Edetabeli andmeid pole veel saadaval.' }: { rows: LeaderboardRowView[]; emptyMessage?: string }) {
  if (rows.length === 0) {
    return <p className="empty-state">{emptyMessage}</p>;
  }

  return (
    <section className="leaderboard-table" aria-label="Ennustusliiga edetabel">
      <div className="leaderboard-table-head" aria-hidden="true">
        <span>Koht</span>
        <span>Mängija</span>
        <span>Punktid</span>
        <span>Täpsed skoorid</span>
        <span>Tabavus</span>
      </div>
      <div className="leaderboard-table-body">
        {rows.map((row) => <LeaderboardRow row={row} key={row.playerId} />)}
      </div>
    </section>
  );
}
