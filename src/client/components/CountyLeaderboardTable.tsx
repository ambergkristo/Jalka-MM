import type { CountyLeaderboardRow } from '../../domain/countyLeaderboard.js';
import { resolveCountyVisual } from '../lib/countyVisuals.js';

export function CountyLeaderboardTable({ rows }: { rows: CountyLeaderboardRow[] }) {
  return (
    <section className="county-leaderboard-table" aria-label="Maakondade edetabel">
      <div className="county-leaderboard-row county-leaderboard-head" aria-hidden="true">
        <span>Koht</span>
        <span>Maakond</span>
        <span>Mängijaid</span>
        <span>Punkte</span>
      </div>
      {rows.length === 0 && <p className="empty-state">Andmed puuduvad</p>}
      {rows.map((row) => (
        <div className={`county-leaderboard-row rank-${row.rank <= 3 ? row.rank : 'standard'}`} key={row.county}>
          <b>{row.rank}</b>
          <span className="county-leaderboard-county">
            <CountyVisual county={row.county} />
            <span className="county-leaderboard-copy">
              <strong>{row.county}</strong>
              {row.topPlayers.length > 0 && (
                <small>{row.topPlayers.map((player) => `${player.playerName} ${player.points}`).join(' · ')}</small>
              )}
            </span>
          </span>
          <span>{row.playerCount}</span>
          <strong className="county-leaderboard-points">{row.totalPoints}</strong>
        </div>
      ))}
    </section>
  );
}

function CountyVisual({ county }: { county: string }) {
  const visual = resolveCountyVisual(county);
  return (
    <span className={`county-crest tone-${visual.tone}`} aria-hidden="true">
      {visual.crestUrl ? <img src={visual.crestUrl} alt="" loading="lazy" decoding="async" /> : visual.initials}
    </span>
  );
}
