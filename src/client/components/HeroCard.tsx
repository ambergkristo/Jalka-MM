import type { DashboardMetric } from '../data/mock.js';

export function HeroCard({ metrics }: { metrics: DashboardMetric[] }) {
  return (
    <section className="hero-card" aria-labelledby="dashboard-title">
      <div className="hero-copy">
        <p className="eyebrow">Public tournament hub</p>
        <h1 id="dashboard-title">MM 2026 Ennustusliiga</h1>
        <p className="hero-lead">Public tournament and prediction tracker.</p>
      </div>

      <div className="hero-scoreboard" aria-label="Tournament status">
        {metrics.map((metric) => (
          <div className="hero-metric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
