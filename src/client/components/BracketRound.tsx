import type { BracketRound as BracketRoundData } from '../data/mock.js';
import { BracketMatchCard } from './BracketMatchCard.js';

export function BracketRound({ round }: { round: BracketRoundData }) {
  return (
    <section className="true-bracket-round" data-round-index={round.roundIndex} aria-label={round.label}>
      <header>{round.label}</header>
      <div className="true-bracket-round-matches">
        {round.matches.map((match) => (
          <BracketMatchCard match={match} key={match.id} />
        ))}
      </div>
    </section>
  );
}
