import type { PlayerProfileView } from '../lib/predictionViewModels.js';
import { StatusBadge } from './StatusBadge.js';

export function ChampionCard({ player }: { player: PlayerProfileView }) {
  return (
    <section className="profile-feature-card champion-card">
      <p className="eyebrow">Predicted Champion</p>
      <strong>{player.predictedChampion}</strong>
      <StatusBadge value={player.championStatus} tone={player.championStatus === 'Eliminated' ? 'danger' : player.championStatus === 'Won Tournament' ? 'gold' : 'good'} />
    </section>
  );
}
