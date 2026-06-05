import { Card } from '../components/Card.js';
import { MatchCard } from '../components/MatchCard.js';
import { PageHeader } from '../components/PageHeader.js';
import { ResultCard } from '../components/ResultCard.js';
import { confirmedLatestResults, getPublicMatchSection, upcomingFixtures } from '../data/publicDashboard.js';
import { usePublicDashboardSnapshot } from '../lib/publicApi.js';

export function ResultsPage() {
  const dashboardSnapshot = usePublicDashboardSnapshot();
  const matchSection = getPublicMatchSection();
  const upcoming = upcomingFixtures(new Date(), 6);
  const latestResults = dashboardSnapshot?.latestResults ?? confirmedLatestResults;

  return (
    <>
      <PageHeader eyebrow="Tulemused" title="Mängud ja tulemused" description="Tänased mängud, värsked tulemused ja turniiri ajakava." />
      <section className="dashboard-grid">
        <Card title={matchSection.title} eyebrow={matchSection.eyebrow}>
          <div className="match-card-grid">
            {matchSection.matches.map((match) => <MatchCard match={match} key={match.id} />)}
          </div>
        </Card>
        <Card title="Viimased tulemused" eyebrow="Lõppenud">
          {latestResults.length > 0 ? (
            <div className="result-card-grid">
              {latestResults.map((result) => <ResultCard result={result} key={result.id} />)}
            </div>
          ) : (
            <p className="empty-state">Lõppenud mänge veel ei ole.</p>
          )}
        </Card>
        <Card title="Tulevad mängud" eyebrow="Ajakava">
          <div className="match-card-grid">
            {upcoming.map((match) => <MatchCard match={match} key={match.id} />)}
          </div>
        </Card>
        <Card title="Otsemängud" eyebrow="Otse">
          <p className="empty-state">Hetkel ei ole käimasolevaid mänge.</p>
        </Card>
      </section>
    </>
  );
}
