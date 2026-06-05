import { BracketCard } from '../components/BracketCard.js';
import { ChampionCard } from '../components/ChampionCard.js';
import { GroupPredictionAccordion } from '../components/GroupPredictionAccordion.js';
import { PlayerSummaryCard } from '../components/PlayerSummaryCard.js';
import { TopScorerCard } from '../components/TopScorerCard.js';
import { getPlayerProfile } from '../lib/predictionViewModels.js';

export function PlayerDetailPage({ playerId }: { playerId: string }) {
  const player = getPlayerProfile(playerId);

  if (!player) {
    return (
      <section className="player-profile-page">
        <div className="profile-empty-state">
          <p className="eyebrow">Player profile</p>
          <h1>Player not found</h1>
          <span>Prediction seed data does not contain a player with id "{playerId}".</span>
          <a className="button-link" href="/leaderboard">Back to Leaderboard</a>
        </div>
      </section>
    );
  }

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
