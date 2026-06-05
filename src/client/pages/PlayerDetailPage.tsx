import { Card } from '../components/Card.js';
import { PageHeader } from '../components/PageHeader.js';
import { leaderboardPreview } from '../data/mock.js';

export function PlayerDetailPage({ playerId }: { playerId: string }) {
  const player = leaderboardPreview.find((row) => row.playerId === playerId) ?? leaderboardPreview[0];

  return (
    <>
      <PageHeader eyebrow="Player profile" title={player.player} description="Public prediction profile skeleton. Final imported prediction data will populate this route later." />

      <section className="metric-grid">
        <Metric label="Rank" value={`#${player.rank}`} />
        <Metric label="Points" value={String(player.points)} />
        <Metric label="Exact Scores" value={String(player.exactScores)} />
        <Metric label="Hit Rate" value={player.hitRate} />
      </section>

      <section className="dashboard-grid">
        <Card title="Predicted Champion" eyebrow="Awards">
          <p className="placeholder-value">TBD Team</p>
        </Card>
        <Card title="Predicted Top Scorer" eyebrow="Awards">
          <p className="placeholder-value">TBD Player</p>
        </Card>
        <Card title="Predicted Playoff Bracket" eyebrow="Knockout">
          <div className="bracket-placeholder">
            <span>R32</span>
            <span>R16</span>
            <span>QF</span>
            <span>SF</span>
            <span>Final</span>
          </div>
        </Card>
        <Card title="Group Predictions" eyebrow="Groups">
          {['A', 'B', 'C', 'D'].map((group) => (
            <details className="accordion" key={group}>
              <summary>Group {group}</summary>
              <p>Winner, runner-up, and advancing teams will appear here after Excel import.</p>
            </details>
          ))}
        </Card>
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
