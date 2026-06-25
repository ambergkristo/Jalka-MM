import { useDeferredValue, useId, useState } from 'react';
import { Card } from '../components/Card.js';
import { LeaderboardTable } from '../components/LeaderboardTable.js';
import { PageHeader } from '../components/PageHeader.js';
import { PublicDataNotice } from '../components/PublicDataNotice.js';
import { filterLeaderboardRows } from '../lib/leaderboardSearch.js';
import { usePublicTournamentState } from '../lib/publicApi.js';

export function LeaderboardPage() {
  const tournamentState = usePublicTournamentState(60_000);
  const leaderboardRows = tournamentState.leaderboardRows;
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const searchInputId = useId();
  const filteredRows = filterLeaderboardRows(leaderboardRows, deferredQuery);
  const activeQuery = deferredQuery.trim();
  const resultLabel = activeQuery
    ? `${filteredRows.length} / ${leaderboardRows.length} mälumängijat`
    : `${leaderboardRows.length} mälumängijat`;

  return (
    <>
      <PageHeader eyebrow="Edetabel" title="Ennustusliiga seis" description="Võrdle mängijate kohti, punkte, täpseid skoore ja tabavust." />
      {tournamentState.snapshotError ? <PublicDataNotice message={tournamentState.snapshotError} /> : null}
      <Card className="leaderboard-page-card">
        <div className="leaderboard-search-panel">
          <label htmlFor={searchInputId}>Leia mängija</label>
          <div className="leaderboard-search-row">
            <input
              id={searchInputId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Otsi nime järgi..."
              autoComplete="off"
            />
            <span>{resultLabel}</span>
          </div>
        </div>
        <LeaderboardTable
          rows={filteredRows}
          emptyMessage={activeQuery ? `Mängijat "${activeQuery}" ei leitud.` : undefined}
        />
      </Card>
    </>
  );
}
