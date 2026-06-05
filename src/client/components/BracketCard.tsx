import type { KnockoutRoundPrediction } from '../data/mock.js';

export function BracketCard({ rounds }: { rounds: KnockoutRoundPrediction[] }) {
  return (
    <section className="bracket-card">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Knockout prediction</p>
          <h2>Predicted Playoff Bracket</h2>
        </div>
      </div>
      <div className="bracket-round-list">
        {rounds.map((round) => (
          <article className="bracket-round-card" key={round.round}>
            <span>{round.round}</span>
            <div>
              {round.teams.map((team) => <strong key={team}>{team}</strong>)}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
