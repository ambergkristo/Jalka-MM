import { Card } from '../components/Card.js';
import { GroupLeaderGrid } from '../components/GroupLeaderGrid.js';
import { HeroCard } from '../components/HeroCard.js';
import { LeaderboardPreview } from '../components/LeaderboardPreview.js';
import { MatchCard } from '../components/MatchCard.js';
import { NavigationCards } from '../components/NavigationCards.js';
import { ResultCard } from '../components/ResultCard.js';
import { groupLeaders, heroMetrics, navigationCards } from '../data/mock.js';
import { confirmedLatestResults, getPublicMatchSection } from '../data/publicDashboard.js';
import { getLeaderboardRows } from '../lib/predictionViewModels.js';

export function LandingDashboard() {
  const leaderboardPreview = getLeaderboardRows().slice(0, 5);
  const matchSection = getPublicMatchSection();

  return (
    <div className="landing-dashboard">
      <HeroCard metrics={heroMetrics} />

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
        {confirmedLatestResults.length > 0 ? (
          <div className="result-card-grid">
            {confirmedLatestResults.map((result) => <ResultCard result={result} key={result.id} />)}
          </div>
        ) : (
          <p className="empty-state">Lõppenud mänge veel ei ole.</p>
        )}
      </Card>

      <LeaderboardPreview rows={leaderboardPreview} />

      <Card>
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Turniiri seis</p>
            <h2>Alagruppide liidrid</h2>
          </div>
          <span className="section-count">A-L</span>
        </div>
        <GroupLeaderGrid groups={groupLeaders} />
      </Card>

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
