import type { DashboardMatch } from '../data/mock.js';

export function MatchCard({ match }: { match: DashboardMatch }) {
  return (
    <article className="match-card-premium">
      <div className="match-card-topline">
        <span>{match.stage}</span>
        <em>{statusLabel(match.status)}</em>
      </div>
      <div className="match-teams">
        <strong>{match.homeTeam}</strong>
        <span>{match.kickoffTime}</span>
        <strong>{match.awayTeam}</strong>
      </div>
      <p>{match.venue}</p>
    </article>
  );
}

function statusLabel(status: DashboardMatch['status']) {
  return {
    scheduled: 'Scheduled',
    live: 'Live',
    final: 'Final'
  }[status];
}
