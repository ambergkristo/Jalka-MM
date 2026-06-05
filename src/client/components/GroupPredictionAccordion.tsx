import type { GroupPredictionRow } from '../data/mock.js';

export function GroupPredictionAccordion({ groups }: { groups: GroupPredictionRow[] }) {
  return (
    <section className="group-prediction-card">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Group predictions</p>
          <h2>Predicted Group Standings</h2>
        </div>
      </div>
      <div className="group-accordion-list">
        {groups.map((group) => (
          <details className="group-accordion" key={group.group}>
            <summary>Group {group.group}</summary>
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
