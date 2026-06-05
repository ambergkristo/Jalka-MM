import type { PlayerProfileData } from '../data/mock.js';
import { StatusBadge } from './StatusBadge.js';

export function TopScorerCard({ player }: { player: PlayerProfileData }) {
  const prediction = player.topScorerPrediction;

  return (
    <section className="profile-feature-card top-scorer-card">
      <p className="eyebrow">Predicted Top Scorer</p>
      <strong>{prediction.name}</strong>
      <span>{prediction.team}</span>
      <div className="top-scorer-meta">
        <b>{prediction.currentGoals} goals</b>
        <StatusBadge value={prediction.status} tone={prediction.status === 'Eliminated' ? 'danger' : prediction.status === 'Leading' ? 'gold' : 'neutral'} />
      </div>
    </section>
  );
}
