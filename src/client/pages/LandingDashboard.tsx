import { Card } from '../components/Card.js';
import { GroupLeaderGrid } from '../components/GroupLeaderGrid.js';
import { HeroCard } from '../components/HeroCard.js';
import { LeaderboardPreview } from '../components/LeaderboardPreview.js';
import { MatchCard } from '../components/MatchCard.js';
import { NavigationCards } from '../components/NavigationCards.js';
import { ResultCard } from '../components/ResultCard.js';
import { groupLeaders, heroMetrics, latestResults, leaderboardPreview, navigationCards, todaysMatches } from '../data/mock.js';

export function LandingDashboard() {
  return (
    <div className="landing-dashboard">
      <HeroCard metrics={heroMetrics} />

      <Card className="today-card">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Today</p>
            <h2>Today's Matches</h2>
          </div>
          <span className="section-count">{todaysMatches.length} matches</span>
        </div>
        <div className="match-card-grid">
          {todaysMatches.map((match) => <MatchCard match={match} key={match.id} />)}
        </div>
      </Card>

      <Card>
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Just happened</p>
            <h2>Latest Results</h2>
          </div>
        </div>
        <div className="result-card-grid">
          {latestResults.map((result) => <ResultCard result={result} key={result.id} />)}
        </div>
      </Card>

      <LeaderboardPreview rows={leaderboardPreview} />

      <Card>
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Tournament situation</p>
            <h2>Group Leaders</h2>
          </div>
          <span className="section-count">A-L</span>
        </div>
        <GroupLeaderGrid groups={groupLeaders} />
      </Card>

      <Card>
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Move around</p>
            <h2>Quick Navigation</h2>
          </div>
        </div>
        <NavigationCards items={navigationCards} />
      </Card>
    </div>
  );
}
