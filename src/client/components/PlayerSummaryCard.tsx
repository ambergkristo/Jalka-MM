import type { PlayerProfileData } from '../data/mock.js';
import { PositionChange } from './PositionChange.js';

export function PlayerSummaryCard({ player }: { player: PlayerProfileData }) {
  return (
    <section className="player-summary-card">
      <div>
        <p className="eyebrow">Player profile</p>
        <h1>{player.name}</h1>
      </div>
      <div className="player-summary-rank">
        <span>Rank</span>
        <strong>#{player.rank}</strong>
        <PositionChange value={player.positionChange} />
      </div>
      <div className="player-summary-metrics">
        <Metric label="Points" value={String(player.points)} />
        <Metric label="Exact Scores" value={String(player.exactScores)} />
        <Metric label="Correct Results" value={String(player.correctResults)} />
        <Metric label="Hit Rate" value={player.hitRate} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="profile-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
