import type { DashboardResult } from '../data/mock.js';

export function ResultCard({ result }: { result: DashboardResult }) {
  const homeWon = result.winner === result.homeTeam;
  const awayWon = result.winner === result.awayTeam;

  return (
    <article className="result-card">
      <div className="match-card-topline">
        <span>{result.stage}</span>
        <em>{result.finishedAt}</em>
      </div>
      <div className="result-scoreline">
        <strong className={homeWon ? 'winner' : ''}>{result.homeTeam}</strong>
        <span>{result.homeScore}</span>
        <small>-</small>
        <span>{result.awayScore}</span>
        <strong className={awayWon ? 'winner' : ''}>{result.awayTeam}</strong>
      </div>
      <p>{result.winner === 'Draw' ? 'Points shared' : `${result.winner} take control`}</p>
    </article>
  );
}
