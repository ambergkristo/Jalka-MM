import { Card } from '../components/Card.js';
import { PageHeader } from '../components/PageHeader.js';
import { leaderboardPreview } from '../data/mock.js';

export function LeaderboardPage() {
  return (
    <>
      <PageHeader eyebrow="Leaderboard" title="Prediction League Standings" description="Placeholder ranking table for saved leaderboard entries." />
      <Card>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Points</th>
                <th>Exact Scores</th>
                <th>Hit Rate</th>
              </tr>
            </thead>
            <tbody>
              {leaderboardPreview.map((row) => (
                <tr key={row.playerId}>
                  <td>{row.rank}</td>
                  <td><a href={`/player/${row.playerId}`}>{row.player}</a></td>
                  <td>{row.points}</td>
                  <td>{row.exactScores}</td>
                  <td>{row.hitRate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
