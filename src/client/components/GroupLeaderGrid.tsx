import type { GroupLeader } from '../data/mock.js';
import { teamFromName } from '../lib/teamLookup.js';
import { TeamBadge } from './TeamBadge.js';

export function GroupLeaderGrid({ groups }: { groups: GroupLeader[] }) {
  return (
    <section className="group-leader-grid">
      {groups.map((group) => (
        <article className="group-leader-card" key={group.group}>
          <span>Alagrupp {group.group}</span>
          <TeamBadge team={teamFromName(group.team)} />
          <small>{group.points} p - {group.record}</small>
        </article>
      ))}
    </section>
  );
}
