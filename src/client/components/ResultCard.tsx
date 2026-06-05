import type { DashboardResult } from '../data/mock.js';
import { displayTeamName, teamFromName } from '../lib/teamLookup.js';
import { TeamBadge } from './TeamBadge.js';

export function ResultCard({ result }: { result: DashboardResult }) {
  const homeWon = result.winner === result.homeTeam;
  const awayWon = result.winner === result.awayTeam;

  return (
    <article className="result-card">
      <div className="match-card-topline">
        <span>{result.stage}</span>
        <em>{result.finishedAt}</em>
      </div>
      <div className="result-scoreline">
        <span className={`result-team ${homeWon ? 'winner' : ''}`.trim()}>
          <TeamBadge team={teamFromName(result.homeTeam)} />
        </span>
        <span>{result.homeScore}</span>
        <small>-</small>
        <span>{result.awayScore}</span>
        <span className={`result-team ${awayWon ? 'winner' : ''}`.trim()}>
          <TeamBadge team={teamFromName(result.awayTeam)} align="right" />
        </span>
      </div>
      <p>{result.winner === 'Draw' ? 'Punktid läksid jagamisele' : `${displayTeamName(result.winner)} võttis tähtsa võidu`}</p>
    </article>
  );
}
