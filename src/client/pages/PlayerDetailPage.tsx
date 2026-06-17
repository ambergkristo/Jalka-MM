import { BracketCard } from '../components/BracketCard.js';
import { ChampionCard } from '../components/ChampionCard.js';
import { GroupPredictionAccordion } from '../components/GroupPredictionAccordion.js';
import { PlayerSummaryCard } from '../components/PlayerSummaryCard.js';
import { TopScorerCard } from '../components/TopScorerCard.js';
import { usePublicTournamentState } from '../lib/publicApi.js';
import { applyLeaderboardRowToPlayerProfile, applyTopScorersToPlayerProfile, getPlayerProfile } from '../lib/predictionViewModels.js';

export function PlayerDetailPage({ playerId }: { playerId: string }) {
  const player = getPlayerProfile(playerId);
  const tournamentState = usePublicTournamentState(60_000);
  const leaderboardRows = tournamentState.leaderboardRows;
  const publicLeaderboardRow = leaderboardRows.find((row) => row.playerId === playerId) ?? (player ? {
    rank: player.rank,
    playerId: player.playerId,
    player: player.name,
    points: player.points,
    exactScores: player.exactScores,
    correctResults: player.correctResults,
    hitRate: player.hitRate,
    positionChange: player.positionChange
  } : undefined);

  if (!player) {
    return (
      <section className="player-profile-page">
        <div className="profile-empty-state">
          <p className="eyebrow">Mängija profiil</p>
          <h1>Mängijat ei leitud</h1>
          <span>Selle id-ga mängijat ennustusandmetes ei ole: "{playerId}".</span>
          <a className="button-link" href="/leaderboard">Tagasi edetabelisse</a>
        </div>
      </section>
    );
  }

  const visiblePlayer = applyTopScorersToPlayerProfile(applyLeaderboardRowToPlayerProfile(player, publicLeaderboardRow), tournamentState.topScorers);

  return (
    <div className="player-profile-page">
      <PlayerSummaryCard player={visiblePlayer} />

      <section className="profile-feature-grid">
        <ChampionCard player={visiblePlayer} />
        <TopScorerCard player={visiblePlayer} />
      </section>

      <BracketCard rounds={visiblePlayer.knockoutPrediction} />
      <GroupPredictionAccordion groups={visiblePlayer.groupPredictions} />
    </div>
  );
}
