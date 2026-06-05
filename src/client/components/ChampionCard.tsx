import type { PlayerProfileView } from '../lib/predictionViewModels.js';
import { StatusBadge } from './StatusBadge.js';

export function ChampionCard({ player }: { player: PlayerProfileView }) {
  return (
    <section className="profile-feature-card champion-card">
      <p className="eyebrow">Ennustatud meister</p>
      <strong>{player.predictedChampion}</strong>
      <StatusBadge value={statusLabel(player.championStatus)} tone={player.championStatus === 'Eliminated' ? 'danger' : player.championStatus === 'Won Tournament' ? 'gold' : 'good'} />
    </section>
  );
}

function statusLabel(status: PlayerProfileView['championStatus']) {
  return {
    'Still alive': 'Veel konkurentsis',
    Eliminated: 'Väljas',
    'Won Tournament': 'Võitis turniiri'
  }[status];
}
