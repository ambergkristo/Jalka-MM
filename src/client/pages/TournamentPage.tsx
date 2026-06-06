import { Card } from '../components/Card.js';
import { GroupStandingsGrid } from '../components/GroupStandingsGrid.js';
import { PageHeader } from '../components/PageHeader.js';
import { TopScorersTable } from '../components/TopScorersTable.js';
import { TournamentStatsCards } from '../components/TournamentStatsCards.js';
import { TournamentSummaryCards } from '../components/TournamentSummaryCards.js';
import { TrueBracket } from '../components/TrueBracket.js';
import {
  initialGroupStandings,
  initialPlayoffBracket,
  initialTournamentProgressByStage,
  initialTournamentStats,
  initialTournamentSummary
} from '../data/publicTournamentFallback.js';
import { usePublicDashboardSnapshot } from '../lib/publicApi.js';

export function TournamentPage() {
  const dashboardSnapshot = usePublicDashboardSnapshot();
  const visibleSummary = dashboardSnapshot?.tournamentSummary ?? initialTournamentSummary;
  const visibleProgress = dashboardSnapshot?.tournamentProgressByStage ?? initialTournamentProgressByStage;
  const visibleGroups = dashboardSnapshot?.groupStandings ?? initialGroupStandings;
  const visibleTopScorers = dashboardSnapshot?.topScorers ?? [];
  const visibleStats = dashboardSnapshot?.tournamentStats ?? initialTournamentStats;
  const visibleBracket = dashboardSnapshot?.playoffBracket ?? initialPlayoffBracket;

  return (
    <section className="tournament-center-page">
      <PageHeader
        eyebrow="Turniir"
        title="MM 2026 turniiri ülevaade"
        description="Alagrupid, play-off, väravalööjad, statistika ja mängude edenemine."
      />

      <Card title="Turniiri kokkuvõte" eyebrow="Hetkeseis" className="tournament-section">
        <TournamentSummaryCards metrics={visibleSummary} />
        <div className="stage-progress-list" aria-label="Mängude edenemine etappide kaupa">
          {visibleProgress.map((stage) => {
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
        <GroupStandingsGrid groups={visibleGroups} />
      </Card>

      <Card title="Play-off" eyebrow="Tabelipuu" className="tournament-section bracket-section">
        <TrueBracket tree={visibleBracket} />
      </Card>

      <section className="tournament-secondary-grid">
        <Card title="Väravalööjad" eyebrow="Väravaküttide seis" className="tournament-section">
          <TopScorersTable scorers={visibleTopScorers} />
        </Card>

        <Card title="Turniiri statistika" eyebrow="Numbrid" className="tournament-section">
          <TournamentStatsCards stats={visibleStats} />
        </Card>
      </section>
    </section>
  );
}
