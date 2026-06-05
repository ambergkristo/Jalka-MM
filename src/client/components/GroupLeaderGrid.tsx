import type { GroupLeader } from '../data/mock.js';
import { teamFromName } from '../lib/teamLookup.js';
import { TeamBadge } from './TeamBadge.js';

export function GroupLeaderGrid({ groups }: { groups: GroupLeader[] }) {
  return (
    <section className="group-leader-grid">
      {groups.map((group) => (
        <a className="group-leader-card" href={`/tournament#group-${group.group.toLowerCase()}`} key={group.group}>
          <span>Alagrupp {group.group}</span>
          {group.team ? <TeamBadge team={teamFromName(group.team)} /> : <strong>Vaata alagruppi</strong>}
          <small>{group.points !== undefined && group.record ? `${group.points} p - ${group.record}` : 'Tabel avaneb turniiri vaates'}</small>
        </a>
      ))}
    </section>
  );
}
