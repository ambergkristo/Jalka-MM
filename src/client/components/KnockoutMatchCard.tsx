import type { KnockoutMatch } from '../data/mock.js';
import { displayTeamName, teamFromName } from '../lib/teamLookup.js';
import { TeamBadge } from './TeamBadge.js';

function hasScore(match: KnockoutMatch): match is KnockoutMatch & { teamOneScore: number; teamTwoScore: number } {
  return typeof match.teamOneScore === 'number' && typeof match.teamTwoScore === 'number';
}

export function KnockoutMatchCard({ match }: { match: KnockoutMatch }) {
  return (
    <article className={`knockout-match-card ${match.winner ? 'finished' : ''}`.trim()}>
      <div className="knockout-match-topline">
        <span>{match.label}</span>
        <strong>{statusLabel(match.status)}</strong>
      </div>
      <div className="knockout-team-row">
        <span className={match.winner === match.teamOne ? 'winner' : ''}>
          <TeamBadge team={teamFromName(match.teamOne)} />
        </span>
        {hasScore(match) && <b>{match.teamOneScore}</b>}
      </div>
      <div className="knockout-team-row">
        <span className={match.winner === match.teamTwo ? 'winner' : ''}>
          <TeamBadge team={teamFromName(match.teamTwo)} />
        </span>
        {hasScore(match) && <b>{match.teamTwoScore}</b>}
      </div>
      <small>{match.winner ? `${displayTeamName(match.winner)} edasi` : match.kickoffTime}</small>
    </article>
  );
}

function statusLabel(status: KnockoutMatch['status']) {
  return {
    scheduled: 'Algamas',
    live: 'Otse',
    finished: 'Lõppenud',
    'extra-time': 'Lisaajal',
    penalties: 'Penaltid'
  }[status];
}
