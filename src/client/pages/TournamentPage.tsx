import { Card } from '../components/Card.js';
import { GroupStandingsGrid } from '../components/GroupStandingsGrid.js';
import { KnockoutStage } from '../components/KnockoutStage.js';
import { PageHeader } from '../components/PageHeader.js';
import { TopScorersTable } from '../components/TopScorersTable.js';
import { TournamentStatsCards } from '../components/TournamentStatsCards.js';
import { TournamentSummaryCards } from '../components/TournamentSummaryCards.js';
import {
  groupStandings,
  knockoutStages,
  tournamentProgressByStage,
  tournamentStats,
  tournamentSummary,
  tournamentTopScorers
} from '../data/mock.js';

export function TournamentPage() {
  return (
    <section className="tournament-center-page">
      <PageHeader
        eyebrow="Turniir"
        title="MM 2026 turniiri ülevaade"
        description="Alagrupid, play-off, väravalööjad, statistika ja mängude edenemine."
      />

      <Card title="Turniiri kokkuvõte" eyebrow="Hetkeseis" className="tournament-section">
        <TournamentSummaryCards metrics={tournamentSummary} />
        <div className="stage-progress-list" aria-label="Mängude edenemine etappide kaupa">
          {tournamentProgressByStage.map((stage) => {
            const percent = Math.round((stage.completed / stage.total) * 100);
            return (
              <article className="stage-progress-row" key={stage.stage}>
                <div>
                  <strong>{stage.stage}</strong>
                  <span>{stage.completed} / {stage.total} mängu</span>
                </div>
                <div className="stage-progress-track" aria-hidden="true">
                  <span style={{ width: `${percent}%` }} />
                </div>
                <b>{percent}%</b>
              </article>
            );
          })}
        </div>
      </Card>

      <Card title="Alagrupitabelid" eyebrow="Alagrupid A-L" className="tournament-section">
        <GroupStandingsGrid groups={groupStandings} />
      </Card>

      <Card title="Play-off" eyebrow="Edenemise vaade" className="tournament-section">
        <section className="knockout-progression" aria-label="Play-off edenemine">
          {knockoutStages.map((stage) => (
            <KnockoutStage stage={stage} key={stage.stage} />
          ))}
        </section>
      </Card>

      <section className="tournament-secondary-grid">
        <Card title="Väravalööjad" eyebrow="Väravaküttide seis" className="tournament-section">
          <TopScorersTable scorers={tournamentTopScorers} />
        </Card>

        <Card title="Turniiri statistika" eyebrow="Numbrid" className="tournament-section">
          <TournamentStatsCards stats={tournamentStats} />
        </Card>
      </section>
    </section>
  );
}
