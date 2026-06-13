import type { TournamentTopScorer } from '../data/mock.js';
import { teamFromName } from '../lib/teamLookup.js';
import { TeamBadge } from './TeamBadge.js';

export function TopScorersTable({ scorers }: { scorers: TournamentTopScorer[] }) {
  return (
    <section className="top-scorers-table" aria-label="Väravalööjate tabel">
      <div className="top-scorer-row top-scorer-head">
        <span>Koht</span>
        <span>Mängija</span>
        <span>Võistkond</span>
        <span>V</span>
        <span>S</span>
      </div>
      {scorers.length === 0 && <p className="empty-state">Väravalööjate info ei ole veel saadaval.</p>}
      {scorers.map((scorer) => (
        <div className={`top-scorer-row rank-${scorer.rank}`} key={`${scorer.rank}-${scorer.player}`}>
          <b>{scorer.rank}</b>
          <strong>{scorer.player}</strong>
          <TeamBadge team={teamFromName(scorer.team)} />
          <span>{scorer.goals}</span>
          <span>{scorer.assists}</span>
        </div>
      ))}
    </section>
  );
}
