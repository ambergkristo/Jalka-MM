import type { Team } from '../../domain/types.js';
import { flagIconUrl } from '../lib/flagAssets.js';

const PLACEHOLDER_ICON = '\u26bd';

type TeamBadgeTeam = Partial<Team> & { name_et?: string };

export function TeamBadge({ team, slotLabel, align = 'left' }: { team?: TeamBadgeTeam | null; slotLabel?: string; align?: 'left' | 'right' }) {
  const name = team?.name_et || team?.nameEt || team?.name || slotLabel || 'Selgumisel';
  const code = team?.code;
  const flagUrl = flagIconUrl(code);

  return (
    <span className={`team-badge ${align === 'right' ? 'right' : ''}`}>
      <span className="team-flag" aria-hidden="true">
        {flagUrl ? <img className="team-flag-img" src={flagUrl} alt="" loading="lazy" decoding="async" /> : PLACEHOLDER_ICON}
      </span>
      <span className="team-copy">
        <strong>{name}</strong>
        {code && <small>{code}</small>}
      </span>
    </span>
  );
}

export function visibleFlag(flag: unknown): string {
  return validFlag(flag) ? flag : PLACEHOLDER_ICON;
}

function validFlag(flag: unknown): flag is string {
  return typeof flag === 'string' && flag.trim() !== '' && !flag.includes('?') && !flag.includes('\ufffd');
}
