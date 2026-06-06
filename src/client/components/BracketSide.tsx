import type { BracketSide as BracketSideData } from '../../domain/publicBracket.js';
import { BracketRound } from './BracketRound.js';

export function BracketSide({ side }: { side: BracketSideData }) {
  const rounds = side.side === 'RIGHT' ? [...side.rounds].reverse() : side.rounds;

  return (
    <section className={`true-bracket-side ${side.side.toLowerCase()}`} aria-label={side.side === 'LEFT' ? 'Vasak pool' : 'Parem pool'}>
      <h3>{side.side === 'LEFT' ? 'Vasak pool' : 'Parem pool'}</h3>
      <div className="true-bracket-rounds">
        {rounds.map((round) => (
          <BracketRound round={round} key={round.id} />
        ))}
      </div>
    </section>
  );
}
