import type { PlayerProfileView } from '../lib/predictionViewModels.js';
import { PositionChange } from './PositionChange.js';

export function PlayerSummaryCard({ player }: { player: PlayerProfileView }) {
  return (
    <section className="player-summary-card">
      <div>
        <p className="eyebrow">Mängija profiil</p>
        <h1>{player.name}</h1>
      </div>
      <div className="player-summary-rank">
        <span>Koht</span>
        <strong>#{player.rank}</strong>
        <PositionChange value={player.positionChange} />
      </div>
      <div className="player-summary-metrics">
        <Metric label="Punktid" value={String(player.points)} />
        <Metric label="Täpsed skoorid" value={String(player.exactScores)} />
        <Metric label="Õiged tulemused" value={String(player.correctResults)} />
        <Metric label="Tabavus" value={player.hitRate} />
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
