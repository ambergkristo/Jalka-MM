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
        eyebrow="Tournament center"
        title="MM 2026 Tournament"
        description="Public tournament overview for groups, knockout path, scorers, statistics, and match progress."
      />

      <Card title="Tournament Summary" eyebrow="Live snapshot" className="tournament-section">
        <TournamentSummaryCards metrics={tournamentSummary} />
        <div className="stage-progress-list" aria-label="Match progress by stage">
          {tournamentProgressByStage.map((stage) => {
            const percent = Math.round((stage.completed / stage.total) * 100);
            return (
              <article className="stage-progress-row" key={stage.stage}>
                <div>
                  <strong>{stage.stage}</strong>
                  <span>{stage.completed} / {stage.total} matches</span>
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

      <Card title="Group Standings" eyebrow="Groups A-L" className="tournament-section">
        <GroupStandingsGrid groups={groupStandings} />
      </Card>

      <Card title="Knockout Bracket" eyebrow="Progression view" className="tournament-section">
        <section className="knockout-progression" aria-label="Knockout bracket progression">
          {knockoutStages.map((stage) => (
            <KnockoutStage stage={stage} key={stage.stage} />
          ))}
        </section>
      </Card>

      <section className="tournament-secondary-grid">
        <Card title="Top Scorers" eyebrow="Golden boot race" className="tournament-section">
          <TopScorersTable scorers={tournamentTopScorers} />
        </Card>

        <Card title="Tournament Statistics" eyebrow="Snapshot" className="tournament-section">
          <TournamentStatsCards stats={tournamentStats} />
        </Card>
      </section>
    </section>
  );
}
