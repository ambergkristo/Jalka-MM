import { BracketCard } from '../components/BracketCard.js';
import { ChampionCard } from '../components/ChampionCard.js';
import { GroupPredictionAccordion } from '../components/GroupPredictionAccordion.js';
import { PlayerSummaryCard } from '../components/PlayerSummaryCard.js';
import { TopScorerCard } from '../components/TopScorerCard.js';
import { findPlayerProfile } from '../data/mock.js';

export function PlayerDetailPage({ playerId }: { playerId: string }) {
  const player = findPlayerProfile(playerId);

  return (
    <div className="player-profile-page">
      <PlayerSummaryCard player={player} />

      <section className="profile-feature-grid">
        <ChampionCard player={player} />
        <TopScorerCard player={player} />
      </section>

      <BracketCard rounds={player.knockoutPrediction} />
      <GroupPredictionAccordion groups={player.groupPredictions} />
    </div>
  );
}
