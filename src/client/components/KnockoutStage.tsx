import type { KnockoutStageData } from '../data/mock.js';
import { KnockoutMatchCard } from './KnockoutMatchCard.js';

export function KnockoutStage({ stage }: { stage: KnockoutStageData }) {
  return (
    <section className="knockout-stage">
      <header>
        <span>{stage.stage}</span>
        <strong>{stage.title}</strong>
      </header>
      <div className="knockout-stage-matches">
        {stage.matches.map((match) => (
          <KnockoutMatchCard match={match} key={match.id} />
        ))}
      </div>
    </section>
  );
}
