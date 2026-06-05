import type { GroupLeader } from '../data/mock.js';

export function GroupLeaderGrid({ groups }: { groups: GroupLeader[] }) {
  return (
    <section className="group-leader-grid">
      {groups.map((group) => (
        <article className="group-leader-card" key={group.group}>
          <span>Group {group.group}</span>
          <strong>{group.team}</strong>
          <small>{group.points} pts - {group.record}</small>
        </article>
      ))}
    </section>
  );
}
