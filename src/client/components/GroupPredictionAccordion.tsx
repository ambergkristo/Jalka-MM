import type { PlayerGroupPredictionView } from '../lib/predictionViewModels.js';
import { TeamBadge } from './TeamBadge.js';

export function GroupPredictionAccordion({ groups }: { groups: PlayerGroupPredictionView[] }) {
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
            <h3>Ennustatud järjestus</h3>
            <ol>
              <li><span>1.</span><strong>{group.first}</strong></li>
              <li><span>2.</span><strong>{group.second}</strong></li>
              <li><span>3.</span><strong>{group.third}</strong></li>
            </ol>
            <div className="group-match-predictions">
              <h3>Mängude ennustused</h3>
              {group.matchPredictions.length > 0 ? (
                <div className="group-match-prediction-list">
                  {group.matchPredictions.map((match) => (
                    <article className="group-match-prediction-row" key={match.matchId}>
                      <TeamBadge team={{ name: match.homeTeam, code: match.homeTeamCode }} />
                      <strong>{match.homeScore}-{match.awayScore}</strong>
                      <TeamBadge team={{ name: match.awayTeam, code: match.awayTeamCode }} align="right" />
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-state">Alagrupi mängude skooriennustusi pole saadaval.</p>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
