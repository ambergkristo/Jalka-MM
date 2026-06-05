import { Card } from '../components/Card.js';
import { LeaderboardTable } from '../components/LeaderboardTable.js';
import { PageHeader } from '../components/PageHeader.js';
import { getLeaderboardRows } from '../lib/predictionViewModels.js';

export function LeaderboardPage() {
  const leaderboardRows = getLeaderboardRows();

  return (
    <>
      <PageHeader eyebrow="Leaderboard" title="Prediction League Standings" description="Compare player rank, points, exact scores, and hit rate." />
      <Card className="leaderboard-page-card">
        <LeaderboardTable rows={leaderboardRows} />
      </Card>
    </>
  );
}
