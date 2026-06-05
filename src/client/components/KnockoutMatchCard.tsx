import type { KnockoutMatch } from '../data/mock.js';

function hasScore(match: KnockoutMatch): match is KnockoutMatch & { teamOneScore: number; teamTwoScore: number } {
  return typeof match.teamOneScore === 'number' && typeof match.teamTwoScore === 'number';
}

export function KnockoutMatchCard({ match }: { match: KnockoutMatch }) {
  return (
    <article className={`knockout-match-card ${match.winner ? 'finished' : ''}`.trim()}>
      <div className="knockout-match-topline">
        <span>{match.label}</span>
        <strong>{match.status}</strong>
      </div>
      <div className="knockout-team-row">
        <span className={match.winner === match.teamOne ? 'winner' : ''}>{match.teamOne}</span>
        {hasScore(match) && <b>{match.teamOneScore}</b>}
      </div>
      <div className="knockout-team-row">
        <span className={match.winner === match.teamTwo ? 'winner' : ''}>{match.teamTwo}</span>
        {hasScore(match) && <b>{match.teamTwoScore}</b>}
      </div>
      <small>{match.winner ? `${match.winner} advanced` : match.kickoffTime}</small>
    </article>
  );
}
