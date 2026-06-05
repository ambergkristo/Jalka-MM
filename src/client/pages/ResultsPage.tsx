import { Card } from '../components/Card.js';
import { PageHeader } from '../components/PageHeader.js';

const sections = ['Today\'s Matches', 'Upcoming Matches', 'Live Matches', 'Finished Matches'];

export function ResultsPage() {
  return (
    <>
      <PageHeader eyebrow="Matches & results" title="Tournament Results" description="Placeholder result sections for the future football API update flow." />
      <section className="dashboard-grid">
        {sections.map((section) => (
          <Card title={section} eyebrow="Results" key={section}>
            <div className="match-item">
              <span>TBD</span>
              <strong>Team A</strong>
              <small>vs</small>
              <strong>Team B</strong>
              <em>Awaiting data</em>
            </div>
          </Card>
        ))}
      </section>
    </>
  );
}
