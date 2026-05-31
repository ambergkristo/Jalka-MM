import { useEffect, useMemo, useState } from 'react';
import { loadBreakdown } from '../api.js';
import { errorEt } from '../lib/messages.js';

export function ScoreDetails({ state, playerId }: { state: any; playerId: string }) {
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [error, setError] = useState('');
  const score = useMemo(() => state.leaderboard.find((row: any) => row.playerId === playerId), [state.leaderboard, playerId]);

  useEffect(() => {
    loadBreakdown(playerId).then(setBreakdown).catch((err) => setError(errorEt(err.message)));
  }, [playerId]);

  if (!score) return <div className="empty">Osalejat ei ole valitud või ta ei ole ametlikus edetabelis.</div>;
  const matchRows = breakdown.filter((row) => row.item_type === 'match');
  const bonusRows = breakdown.filter((row) => row.item_type === 'bonus');

  return (
    <section className="stack">
      <div className="summary"><strong>{score.totalPoints} punkti</strong><span>{score.matchPoints} mängud + {score.bonusPoints} boonused</span></div>
      {error && <div className="error">{error}</div>}
      <BreakdownList title="Mängupunktid" rows={matchRows} empty="Mänguennustuste punkte veel ei ole." />
      <BreakdownList title="Boonuspunktid" rows={bonusRows} empty="Boonuspunkte veel ei ole." />
    </section>
  );
}

function BreakdownList({ title, rows, empty }: { title: string; rows: any[]; empty: string }) {
  return (
    <article className="panel">
      <h2>{title}</h2>
      {rows.length === 0 && <p className="muted">{empty}</p>}
      {rows.map((row) => <div className="breakdown-row" key={`${row.item_type}-${row.item_id}`}><span>{row.item_id}</span><strong>{row.points}p</strong><p>{explanationEt(String(row.explanation))}</p></div>)}
    </article>
  );
}

function explanationEt(value: string): string {
  if (value === '6p: exact score correct') return '6p: täpne skoor';
  if (value === '4p: correct result and goal difference') return '4p: õige tulemus ja väravate vahe';
  if (value === '2p: correct draw') return '2p: õige viik';
  if (value === '2p: correct winner') return '2p: õige võitja';
  if (value === '0p: incorrect result') return '0p: vale tulemus';
  if (value === '10p: correct group winner') return '10p: õige alagrupi võitja';
  if (value === '5p: correct group second place') return '5p: õige alagrupi teine koht';
  if (value === '3p: correct advancing team') return '3p: õige edasipääseja';
  if (value === '40p: correct third-place match winner') return '40p: õige 3. koha mängu võitja';
  if (value === '100p: correct World Cup winner') return '100p: õige maailmameister';
  return value
    .replace('correct country in Round of 16', 'õige riik kaheksandikfinaalis')
    .replace('correct country in quarter-final', 'õige riik veerandfinaalis')
    .replace('correct country in semi-final', 'õige riik poolfinaalis')
    .replace('correct country in final', 'õige riik finaalis')
    .replace(/top scorer split across (\d+) tied player\(s\)/, 'suurima väravaküti punktid jagatud $1 mängija vahel');
}
