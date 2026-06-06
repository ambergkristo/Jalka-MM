import type { BracketMatch } from '../../domain/publicBracket.js';
import { BracketTeamSlot } from './BracketTeamSlot.js';

export function BracketMatchCard({ match, compact = false }: { match: BracketMatch; compact?: boolean }) {
  const homeWinner = Boolean(match.winnerTeamId && match.winnerTeamId === match.homeSlot.teamId);
  const awayWinner = Boolean(match.winnerTeamId && match.winnerTeamId === match.awaySlot.teamId);

  return (
    <article className={`true-bracket-match ${match.stage === 'FINAL' ? 'final' : ''} ${compact ? 'compact' : ''}`.trim()} aria-label={`${matchLabel(match.stage)} ${match.id}`}>
      <div className="true-bracket-match-topline">
        <span>{matchLabel(match.stage)}</span>
        <strong>{statusLabel(match.status)}</strong>
      </div>
      <BracketTeamSlot slot={match.homeSlot} score={match.homeScore} isWinner={homeWinner} />
      <BracketTeamSlot slot={match.awaySlot} score={match.awayScore} isWinner={awayWinner} />
      {match.kickoffUtc && <small>{formatKickoff(match.kickoffUtc)}</small>}
    </article>
  );
}

function matchLabel(stage: BracketMatch['stage']) {
  return {
    R32: '1/16',
    R16: '1/8',
    QF: 'VF',
    SF: 'PF',
    FINAL: 'Finaal',
    THIRD_PLACE: '3. koht'
  }[stage];
}

function statusLabel(status: BracketMatch['status']) {
  return {
    scheduled: 'Algamas',
    live: 'Otse',
    finished: 'Lõppenud',
    'extra-time': 'Lisaajal',
    penalties: 'Penaltid'
  }[status];
}

function formatKickoff(kickoffUtc: string) {
  return new Intl.DateTimeFormat('et-EE', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Tallinn'
  }).format(new Date(kickoffUtc));
}
