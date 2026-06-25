import { Card } from '../components/Card.js';
import { CountyLeaderboardTable } from '../components/CountyLeaderboardTable.js';
import { GroupStandingsGrid } from '../components/GroupStandingsGrid.js';
import { PageHeader } from '../components/PageHeader.js';
import { PredictionLeagueInsights } from '../components/PredictionLeagueInsights.js';
import { PublicDataNotice } from '../components/PublicDataNotice.js';
import { TopScorersTable } from '../components/TopScorersTable.js';
import { TournamentStatsCards } from '../components/TournamentStatsCards.js';
import { TrueBracket } from '../components/TrueBracket.js';
import { usePublicTournamentState } from '../lib/publicApi.js';

export function TournamentPage() {
  const tournamentState = usePublicTournamentState(60_000);

  return (
    <section className="tournament-center-page">
      <PageHeader
        eyebrow="Turniir"
        title="MM 2026 turniiri ülevaade"
        description="Alagrupid, play-off, väravalööjad, statistika ja mängude edenemine."
      />
      {tournamentState.snapshotError ? <PublicDataNotice message={tournamentState.snapshotError} /> : null}

      <Card title="Alagrupitabelid" eyebrow="Alagrupid A-L" className="tournament-section">
        <GroupStandingsGrid groups={tournamentState.groupStandings} />
      </Card>

      <Card title="Play-off" eyebrow="Tabelipuu" className="tournament-section bracket-section">
        <TrueBracket tree={tournamentState.playoffBracket} />
      </Card>

      <section className="tournament-secondary-grid">
        <Card title="Väravalööjad" eyebrow="Väravaküttide seis" className="tournament-section">
          <TopScorersTable scorers={tournamentState.topScorers} />
        </Card>

        <PredictionLeagueInsights insights={tournamentState.predictionLeagueInsights} />
      </section>

      <Card title="Turniiri statistika" eyebrow="Numbrid" className="tournament-section">
        <TournamentStatsCards stats={tournamentState.tournamentStats} />
      </Card>

      <Card title="Maakondade edetabel" eyebrow="Piirkondade punktid" className="tournament-section">
        <CountyLeaderboardTable rows={tournamentState.countyLeaderboard} />
      </Card>
    </section>
  );
}
