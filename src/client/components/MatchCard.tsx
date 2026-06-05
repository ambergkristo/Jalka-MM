import type { DashboardMatch } from '../data/mock.js';
import { teamFromName } from '../lib/teamLookup.js';
import { TeamBadge } from './TeamBadge.js';

export function MatchCard({ match }: { match: DashboardMatch }) {
  return (
    <article className="match-card-premium">
      <div className="match-card-topline">
        <span>{match.stage}</span>
        <em>{statusLabel(match.status)}</em>
      </div>
      <div className="match-teams">
        <TeamBadge team={teamFromName(match.homeTeam)} />
        <span className="match-kickoff">{match.kickoffTime}</span>
        <TeamBadge team={teamFromName(match.awayTeam)} align="right" />
      </div>
      <p>{match.venue}</p>
    </article>
  );
}

function statusLabel(status: DashboardMatch['status']) {
  return {
    scheduled: 'Algamas',
    live: 'Otse',
    final: 'Lõppenud'
  }[status];
}
