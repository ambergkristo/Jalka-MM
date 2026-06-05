import type { TournamentTopScorer } from '../data/mock.js';

export function TopScorersTable({ scorers }: { scorers: TournamentTopScorer[] }) {
  return (
    <section className="top-scorers-table" aria-label="Top scorers">
      <div className="top-scorer-row top-scorer-head">
        <span>Rank</span>
        <span>Player</span>
        <span>Team</span>
        <span>G</span>
        <span>A</span>
      </div>
      {scorers.map((scorer) => (
        <div className={`top-scorer-row rank-${scorer.rank}`} key={`${scorer.rank}-${scorer.player}`}>
          <b>{scorer.rank}</b>
          <strong>{scorer.player}</strong>
          <span>{scorer.team}</span>
          <span>{scorer.goals}</span>
          <span>{scorer.assists}</span>
        </div>
      ))}
    </section>
  );
}
