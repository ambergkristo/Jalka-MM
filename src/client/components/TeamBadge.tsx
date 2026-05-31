import type { Team } from '../../domain/types.js';

export function TeamBadge({ team, slotLabel, align = 'left' }: { team?: Partial<Team> | null; slotLabel?: string; align?: 'left' | 'right' }) {
  const name = (team as any)?.name_et || team?.nameEt || team?.name || slotLabel || 'Võistkond täpsustamisel';
  const code = team?.code;
  const flag = validFlag(team?.flag) ? team?.flag : '•';
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

function validFlag(flag: unknown): flag is string {
  return typeof flag === 'string' && flag.trim() !== '' && !flag.includes('?') && !flag.includes('�');
}
