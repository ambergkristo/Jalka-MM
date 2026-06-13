import type { DashboardMatch } from '../data/mock.js';
import { teamFromName } from '../lib/teamLookup.js';
import { TeamBadge } from './TeamBadge.js';

export function MatchCard({ match }: { match: DashboardMatch }) {
  const hasScore = match.homeScore !== undefined && match.awayScore !== undefined;
  return (
    <article className="match-card-premium">
      <div className="match-card-topline">
        <span>{match.stage}</span>
        <em>{statusLabel(match.status)}</em>
      </div>
      <div className="match-teams">
        <TeamBadge team={teamFromName(match.homeTeam)} />
        {hasScore ? (
          <span className="match-live-score" aria-label={`Hetkeseis ${match.homeScore}-${match.awayScore}`}>
            <strong>{match.homeScore}</strong>
            <span>-</span>
            <strong>{match.awayScore}</strong>
            <small>{match.kickoffTime}</small>
          </span>
        ) : (
          <span className="match-kickoff">{match.kickoffTime}</span>
        )}
        <TeamBadge team={teamFromName(match.awayTeam)} align="right" />
      </div>
      <p>{match.venue}</p>
    </article>
  );
}

function statusLabel(status: DashboardMatch['status']) {
  return {
    scheduled: 'Algamas',
    live: 'OTSE',
    confirming: 'Kinnitamisel',
    final: 'Lõppenud'
  }[status];
}
