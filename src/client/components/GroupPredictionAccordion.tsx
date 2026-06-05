import type { GroupPrediction } from '../../domain/predictionRepository.js';

export function GroupPredictionAccordion({ groups }: { groups: GroupPrediction[] }) {
  if (groups.length === 0) {
    return (
      <section className="group-prediction-card">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Alagruppide ennustus</p>
            <h2>Ennustatud alagrupid</h2>
          </div>
        </div>
        <p className="empty-state">Selle mängija alagrupiennustusi pole veel saadaval.</p>
      </section>
    );
  }

  return (
    <section className="group-prediction-card">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Alagruppide ennustus</p>
          <h2>Ennustatud alagrupid</h2>
        </div>
      </div>
      <div className="group-accordion-list">
        {groups.map((group) => (
          <details className="group-accordion" key={group.group}>
            <summary>Alagrupp {group.group}</summary>
            <ol>
              <li><span>1st</span><strong>{group.first}</strong></li>
              <li><span>2nd</span><strong>{group.second}</strong></li>
              <li><span>3rd</span><strong>{group.third}</strong></li>
            </ol>
          </details>
        ))}
      </div>
    </section>
  );
}
