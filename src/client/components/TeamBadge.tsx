import type { Team } from '../../domain/types.js';

export function TeamBadge({ team, slotLabel, align = 'left' }: { team?: Partial<Team> | null; slotLabel?: string; align?: 'left' | 'right' }) {
  const name = team?.name || slotLabel || 'Team TBC';
  const code = team?.code;
  const flag = team?.flag || '◇';
  return (
    <span className={`team-badge ${align === 'right' ? 'right' : ''}`}>
      <span className="team-flag" aria-hidden="true">{flag}</span>
      <span className="team-copy">
        <strong>{name}</strong>
        {code && <small>{code}</small>}
      </span>
    </span>
  );
}
