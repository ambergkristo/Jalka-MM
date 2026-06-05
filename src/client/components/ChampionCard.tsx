import type { PlayerProfileData } from '../data/mock.js';
import { StatusBadge } from './StatusBadge.js';

export function ChampionCard({ player }: { player: PlayerProfileData }) {
  return (
    <section className="profile-feature-card champion-card">
      <p className="eyebrow">Predicted Champion</p>
      <strong>{player.predictedChampion}</strong>
      <StatusBadge value={player.championStatus} tone={player.championStatus === 'Eliminated' ? 'danger' : player.championStatus === 'Won Tournament' ? 'gold' : 'good'} />
    </section>
  );
}
