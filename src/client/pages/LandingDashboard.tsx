import { Card } from '../components/Card.js';
import { PageHeader } from '../components/PageHeader.js';
import { groupLeaders, leaderboardPreview, matchRows } from '../data/mock.js';

export function LandingDashboard() {
  return (
    <>
      <PageHeader
        eyebrow="Public read-only dashboard"
        title="MM 2026 Tournament & Prediction Tracker"
        description="A match-day home for results, table movement, and private league prediction standings."
      />

      <section className="quick-actions" aria-label="Main sections">
        <a href="/results">Results</a>
        <a href="/leaderboard">Leaderboard</a>
        <a href="/tournament">Tournament</a>
      </section>

      <section className="dashboard-grid">
        <Card title="Today's Matches" eyebrow="Matchday">
          <div className="match-list">
            {matchRows.slice(0, 2).map((match) => <MatchItem key={`${match.home}-${match.away}`} {...match} />)}
          </div>
        </Card>

        <Card title="Latest Results" eyebrow="Final whistle">
          <div className="match-list">
            {matchRows.slice(2).map((match) => <MatchItem key={`${match.home}-${match.away}`} {...match} />)}
          </div>
        </Card>

        <Card title="Top 5 Leaderboard" eyebrow="Prediction league">
          <div className="leader-list">
            {leaderboardPreview.map((row) => (
              <a className="leader-item" href={`/player/${row.playerId}`} key={row.playerId}>
                <b>{row.rank}</b>
                <span>{row.player}</span>
                <strong>{row.points}</strong>
              </a>
            ))}
          </div>
        </Card>

        <Card title="Group Leaders" eyebrow="Tournament">
          <div className="group-grid">
            {groupLeaders.map((group) => (
              <div className="stat-tile" key={group.group}>
                <span>Group {group.group}</span>
                <strong>{group.team}</strong>
                <small>{group.points} pts</small>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </>
  );
}

function MatchItem({ time, home, away, status }: { time: string; home: string; away: string; status: string }) {
  return (
    <div className="match-item">
      <span>{time}</span>
      <strong>{home}</strong>
      <small>vs</small>
      <strong>{away}</strong>
      <em>{status}</em>
    </div>
  );
}
