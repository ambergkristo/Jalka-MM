import { Card } from '../components/Card.js';
import { MatchCard } from '../components/MatchCard.js';
import { PageHeader } from '../components/PageHeader.js';
import { ResultCard } from '../components/ResultCard.js';
import { latestResults, todaysMatches } from '../data/mock.js';

export function ResultsPage() {
  return (
    <>
      <PageHeader eyebrow="Tulemused" title="Mängud ja tulemused" description="Tänased mängud, värsked tulemused ja turniiri ajakava." />
      <section className="dashboard-grid">
        <Card title="Tänased mängud" eyebrow="Täna">
          <div className="match-card-grid">
            {todaysMatches.map((match) => <MatchCard match={match} key={match.id} />)}
          </div>
        </Card>
        <Card title="Viimased tulemused" eyebrow="Lõppenud">
          <div className="result-card-grid">
            {latestResults.map((result) => <ResultCard result={result} key={result.id} />)}
          </div>
        </Card>
        <Card title="Tulevad mängud" eyebrow="Ajakava">
          <p className="empty-state">Järgmised mängud lisatakse siia, kui turniiri ajakava on rakenduse andmetes valmis.</p>
        </Card>
        <Card title="Otsemängud" eyebrow="Otse">
          <p className="empty-state">Hetkel ei ole käimasolevaid mänge.</p>
        </Card>
      </section>
    </>
  );
}
