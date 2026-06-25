import { Card } from '../components/Card.js';
import { HeroCard } from '../components/HeroCard.js';
import { LeaderboardPreview } from '../components/LeaderboardPreview.js';
import { MatchCard } from '../components/MatchCard.js';
import { NavigationCards } from '../components/NavigationCards.js';
import { PublicDataNotice } from '../components/PublicDataNotice.js';
import { ResultCard } from '../components/ResultCard.js';
import { navigationCards } from '../data/navigation.js';
import { usePublicTournamentState } from '../lib/publicApi.js';

export function LandingDashboard() {
  const tournamentState = usePublicTournamentState(30_000);
  const liveSection = {
    ...tournamentState.liveSection,
    matches: tournamentState.liveSection.matches.slice(0, 3)
  };
  const matchSection = {
    ...tournamentState.matchSection,
    matches: tournamentState.matchSection.matches.slice(0, 3)
  };
  const latestResults = tournamentState.latestResults;
  const leaderboardPreview = tournamentState.leaderboardRows.slice(0, 5);
  const topScorersPreview = tournamentState.topScorers.slice(0, 3);
  const countyLeaderboardPreview = tournamentState.countyLeaderboard.slice(0, 3);

  return (
    <div className="landing-dashboard">
      {tournamentState.snapshotError ? <PublicDataNotice message={tournamentState.snapshotError} /> : null}
      <HeroCard metrics={tournamentState.heroMetrics} />

      <Card title={liveSection.title} eyebrow={liveSection.eyebrow}>
        {liveSection.matches.length > 0 ? (
          <div className="match-card-grid">
            {liveSection.matches.map((match) => <MatchCard match={match} key={match.id} />)}
          </div>
        ) : (
          <p className="empty-state">Hetkel otsemänge ei toimu</p>
        )}
      </Card>

      <Card className="today-card">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">{matchSection.eyebrow}</p>
            <h2>{matchSection.title}</h2>
          </div>
          <span className="section-count">{matchSection.matches.length} mängu</span>
        </div>
        <div className="match-card-grid">
          {matchSection.matches.map((match) => <MatchCard match={match} key={match.id} />)}
        </div>
      </Card>

      <Card>
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Viimati</p>
            <h2>Viimased tulemused</h2>
          </div>
        </div>
        {latestResults.length > 0 ? (
          <div className="result-card-grid">
            {latestResults.map((result) => <ResultCard result={result} key={result.id} />)}
          </div>
        ) : (
          <p className="empty-state">Lõppenud mänge veel ei ole.</p>
        )}
      </Card>

      <LeaderboardPreview rows={leaderboardPreview} topScorers={topScorersPreview} countyRows={countyLeaderboardPreview} />

      <Card>
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Kiirelt edasi</p>
            <h2>Kiirviited</h2>
          </div>
        </div>
        <NavigationCards items={navigationCards} />
      </Card>
    </div>
  );
}
