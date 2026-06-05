import { Card } from '../components/Card.js';
import { LeaderboardTable } from '../components/LeaderboardTable.js';
import { PageHeader } from '../components/PageHeader.js';
import { usePersistedLeaderboardRows } from '../lib/publicApi.js';
import { getLeaderboardRows } from '../lib/predictionViewModels.js';

export function LeaderboardPage() {
  const leaderboardRows = usePersistedLeaderboardRows(getLeaderboardRows());

  return (
    <>
      <PageHeader eyebrow="Edetabel" title="Ennustusliiga seis" description="Võrdle mängijate kohti, punkte, täpseid skoore ja tabavust." />
      <Card className="leaderboard-page-card">
        <LeaderboardTable rows={leaderboardRows} />
      </Card>
    </>
  );
}
