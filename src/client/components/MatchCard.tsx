import type { DashboardMatch } from '../data/mock.js';
import { teamFromName } from '../lib/teamLookup.js';
import { TeamBadge } from './TeamBadge.js';

export function MatchCard({ match }: { match: DashboardMatch }) {
  const isLive = match.status === 'live';
  const hasScore = isLive && match.homeScore !== undefined && match.awayScore !== undefined;
  const kickoff = splitKickoff(match.kickoffTime);

  return (
    <article className="match-card-premium">
      <div className="match-card-topline">
        <span>{match.stage}</span>
        <span className="match-card-match-number">{matchNumber(match.id)}</span>
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
          <span className="match-kickoff" aria-label={`Algusaeg ${match.kickoffTime}`}>
            <strong>{kickoff.date}</strong>
            <small>{kickoff.time || 'TBC'}</small>
          </span>
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

function matchNumber(id: string): string {
  const numericId = Number(id);
  return Number.isFinite(numericId) ? `#${numericId}` : id;
}

function splitKickoff(value: string): { date: string; time: string } {
  const normalized = value.trim().replace(/\s+/g, ' ');
  const match = normalized.match(/^(.+?)(?:\s+\u00b7\s+|\s+)(\d{1,2}:\d{2})$/);
  if (match) {
    return {
      date: match[1],
      time: match[2]
    };
  }

  return { date: normalized, time: '' };
}
