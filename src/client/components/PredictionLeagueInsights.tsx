import type { PredictionLeagueInsights as PredictionLeagueInsightsModel } from '../../domain/predictionLeagueInsights.js';
import { Card } from './Card.js';

export function PredictionLeagueInsights({ insights }: { insights: PredictionLeagueInsightsModel }) {
  return (
    <section className="prediction-insights-stack" aria-label="Ennustusliiga statistika ja rekordid">
      <Card title={insights.statistics.title} eyebrow={insights.statistics.eyebrow} className="tournament-section">
        <InsightSection cards={insights.statistics.cards} />
      </Card>
      <Card title={insights.records.title} eyebrow={insights.records.eyebrow} className="tournament-section">
        <InsightSection cards={insights.records.cards} />
      </Card>
    </section>
  );
}

function InsightSection({
  cards
}: Pick<PredictionLeagueInsightsModel['statistics'], 'cards'>) {
  return (
    <section className="prediction-insights-section">
      <div className="prediction-insights-grid">
        {cards.map((card) => (
          <article
            className={`prediction-insight-card ${card.tone}${card.unavailable ? ' unavailable' : ''}`}
            key={card.id}
          >
            <div className="prediction-insight-card__top">
              <span className="prediction-insight-card__badge" aria-hidden="true">{card.badge}</span>
              <strong>{card.title}</strong>
            </div>
            <span className="prediction-insight-card__subject">{card.subject}</span>
            <b>{card.value}</b>
            <small>{card.detail}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
