import { Card } from '../components/Card.js';
import { PageHeader } from '../components/PageHeader.js';
import { groupLeaders, topScorers } from '../data/mock.js';

export function TournamentPage() {
  return (
    <>
      <PageHeader eyebrow="Tournament center" title="MM 2026 Tournament" description="Public tournament overview skeleton for standings, bracket, scorers, and statistics." />
      <section className="dashboard-grid">
        <Card title="Group Standings" eyebrow="Groups">
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
        <Card title="Knockout Bracket" eyebrow="Playoffs">
          <div className="bracket-placeholder">
            <span>R32</span>
            <span>R16</span>
            <span>QF</span>
            <span>SF</span>
            <span>Final</span>
          </div>
        </Card>
        <Card title="Top Scorers" eyebrow="Golden boot">
          <div className="leader-list">
            {topScorers.map((row) => (
              <div className="leader-item" key={row.player}>
                <b>{row.rank}</b>
                <span>{row.player}</span>
                <strong>{row.goals}</strong>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Tournament Statistics" eyebrow="Snapshot">
          <section className="metric-grid compact">
            <div className="metric-card"><span>Matches</span><strong>104</strong></div>
            <div className="metric-card"><span>Teams</span><strong>48</strong></div>
            <div className="metric-card"><span>Groups</span><strong>12</strong></div>
          </section>
        </Card>
      </section>
    </>
  );
}
