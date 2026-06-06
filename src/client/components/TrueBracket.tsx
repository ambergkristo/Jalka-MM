import type { BracketTree } from '../../domain/publicBracket.js';
import { BracketMatchCard } from './BracketMatchCard.js';
import { BracketSide } from './BracketSide.js';
import { BracketTrophyVisual } from './BracketTrophyVisual.js';

export function TrueBracket({ tree }: { tree: BracketTree }) {
  return (
    <section className="true-bracket" aria-label="Play-off tabelipuu">
      <div className="true-bracket-mobile-note">Keri külgsuunas, et näha kogu play-off puud.</div>
      <div className="true-bracket-scroll">
        <div className="true-bracket-grid">
          <BracketSide side={tree.left} />

          <section className="true-bracket-center" aria-label="Finaal">
            <BracketTrophyVisual />
            <div className="true-bracket-center-panel">
              <p>Finaal</p>
              <BracketMatchCard match={tree.final} compact />
            </div>
            <div className="true-bracket-third-place">
              <p>3. koha mäng</p>
              <BracketMatchCard match={tree.thirdPlace} compact />
            </div>
          </section>

          <BracketSide side={tree.right} />
        </div>
      </div>
    </section>
  );
}
