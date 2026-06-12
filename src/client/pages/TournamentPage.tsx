import { Card } from '../components/Card.js';
import { GroupStandingsGrid } from '../components/GroupStandingsGrid.js';
import { PageHeader } from '../components/PageHeader.js';
import { TopScorersTable } from '../components/TopScorersTable.js';
import { TournamentStatsCards } from '../components/TournamentStatsCards.js';
import { TrueBracket } from '../components/TrueBracket.js';
import { usePublicTournamentState } from '../lib/publicApi.js';

export function TournamentPage() {
  const tournamentState = usePublicTournamentState();

  return (
    <section className="tournament-center-page">
      <PageHeader
        eyebrow="Turniir"
        title="MM 2026 turniiri ülevaade"
        description="Alagrupid, play-off, väravalööjad, statistika ja mängude edenemine."
      />

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

        <Card title="Turniiri statistika" eyebrow="Numbrid" className="tournament-section">
          <TournamentStatsCards stats={tournamentState.tournamentStats} />
        </Card>
      </section>
    </section>
  );
}
