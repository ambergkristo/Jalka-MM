import { useEffect, useMemo, useState } from 'react';
import { loadBreakdown } from '../api.js';

export function ScoreDetails({ state, playerId }: { state: any; playerId: string }) {
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [error, setError] = useState('');
  const score = useMemo(() => state.leaderboard.find((row: any) => row.playerId === playerId), [state.leaderboard, playerId]);

  useEffect(() => {
    loadBreakdown(playerId).then(setBreakdown).catch((err) => setError(err.message));
  }, [playerId]);

  if (!score) return <div className="empty">No participant selected.</div>;
  const matchRows = breakdown.filter((row) => row.item_type === 'match');
  const bonusRows = breakdown.filter((row) => row.item_type === 'bonus');

  return (
    <section className="stack">
      <div className="summary"><strong>{score.totalPoints} points</strong><span>{score.matchPoints} match + {score.bonusPoints} bonus</span></div>
      {error && <div className="error">{error}</div>}
      <BreakdownList title="Match breakdown" rows={matchRows} empty="No scored match predictions yet." />
      <BreakdownList title="Bonus breakdown" rows={bonusRows} empty="No awarded bonus points yet." />
    </section>
  );
}

function BreakdownList({ title, rows, empty }: { title: string; rows: any[]; empty: string }) {
  return (
    <article className="panel">
      <h2>{title}</h2>
      {rows.length === 0 && <p className="muted">{empty}</p>}
      {rows.map((row) => <div className="breakdown-row" key={`${row.item_type}-${row.item_id}`}><span>{row.item_id}</span><strong>{row.points}p</strong><p>{row.explanation}</p></div>)}
    </article>
  );
}
