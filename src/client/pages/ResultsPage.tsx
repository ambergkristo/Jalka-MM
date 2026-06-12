import { Card } from '../components/Card.js';
import { MatchCard } from '../components/MatchCard.js';
import { PageHeader } from '../components/PageHeader.js';
import { ResultCard } from '../components/ResultCard.js';
import { buildCanonicalLiveMatchSection, buildCanonicalMatchSection, usePublicTournamentState } from '../lib/publicApi.js';

export function ResultsPage() {
  const tournamentState = usePublicTournamentState();
  const liveSection = buildCanonicalLiveMatchSection(tournamentState.snapshot, 6);
  const matchSection = buildCanonicalMatchSection(tournamentState.snapshot, new Date(), 6);
  const upcoming = tournamentState.upcomingMatches.slice(0, 6);
  const latestResults = tournamentState.latestResults;

  return (
    <>
      <PageHeader eyebrow="Tulemused" title="Mängud ja tulemused" description="Tänased mängud, värsked tulemused ja turniiri ajakava." />
      <section className="dashboard-grid">
        <Card title={liveSection.title} eyebrow={liveSection.eyebrow}>
          {liveSection.matches.length > 0 ? (
            <div className="match-card-grid">
              {liveSection.matches.map((match) => <MatchCard match={match} key={match.id} />)}
            </div>
          ) : (
            <p className="empty-state">Hetkel ei ole käimasolevaid mänge.</p>
          )}
        </Card>
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
      </section>
    </>
  );
}
