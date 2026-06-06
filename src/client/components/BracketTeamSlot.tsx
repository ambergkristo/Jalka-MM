import type { BracketSlot } from '../../domain/publicBracket.js';
import { TeamBadge } from './TeamBadge.js';

export function BracketTeamSlot({ slot, score, isWinner = false }: { slot: BracketSlot; score?: number; isWinner?: boolean }) {
  const hasTeam = Boolean(slot.teamName);

  return (
    <div className={`true-bracket-team ${isWinner ? 'winner' : ''} ${hasTeam ? 'known' : 'pending'}`.trim()}>
      {hasTeam ? (
        <TeamBadge team={{ name: slot.teamName, code: slot.teamCode }} />
      ) : (
        <span className="bracket-seed-label">{slot.seedLabel ?? slot.label}</span>
      )}
      {typeof score === 'number' && <b>{score}</b>}
    </div>
  );
}
