import type { DashboardMetric } from '../data/mock.js';

export function HeroCard({ metrics }: { metrics: DashboardMetric[] }) {
  return (
    <section className="hero-card" aria-labelledby="dashboard-title">
      <div className="hero-copy">
        <h1 id="dashboard-title">
          <span>MM 2026</span>
          <span>Ennustusliiga</span>
        </h1>
        <p className="hero-lead">Turniiri ja sõprade ennustusliiga ülevaade ühes kohas.</p>
      </div>

      <div className="hero-scoreboard" aria-label="Turniiri seis">
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
