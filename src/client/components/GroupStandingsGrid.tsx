import type { GroupStanding } from '../data/mock.js';
import { GroupStandingTable } from './GroupStandingTable.js';

export function GroupStandingsGrid({ groups }: { groups: GroupStanding[] }) {
  return (
    <section className="group-standings-grid">
      {groups.map((group) => (
        <GroupStandingTable group={group} key={group.group} />
      ))}
    </section>
  );
}
