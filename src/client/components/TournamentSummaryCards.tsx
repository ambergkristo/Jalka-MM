import type { TournamentSummaryMetric } from '../data/mock.js';

export function TournamentSummaryCards({ metrics }: { metrics: TournamentSummaryMetric[] }) {
  return (
    <section className="tournament-summary-grid" aria-label="Tournament summary">
      {metrics.map((metric) => (
        <article className={`tournament-summary-card ${metric.tone}`} key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          <small>{metric.detail}</small>
        </article>
      ))}
    </section>
  );
}
