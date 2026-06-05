import type { TournamentStat } from '../data/mock.js';

export function TournamentStatsCards({ stats }: { stats: TournamentStat[] }) {
  return (
    <section className="tournament-stats-grid" aria-label="Tournament statistics">
      {stats.map((stat) => (
        <article className="tournament-stat-card" key={stat.label}>
          <span>{stat.label}</span>
          <strong>{stat.value}</strong>
          <small>{stat.detail}</small>
        </article>
      ))}
    </section>
  );
}
