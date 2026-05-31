export function Leaderboard({ state, onSelect }: { state: any; onSelect: (playerId: string) => void }) {
  const leader = state.leaderboard[0];
  return (
    <section>
      <div className="summary"><strong>{leader?.name ?? 'Liidrit veel ei ole'}</strong><span>Viimati uuendatud {new Date(state.lastUpdated).toLocaleTimeString('et-EE')}</span></div>
      <div className="leaderboard">
        {state.leaderboard.map((row: any, index: number) => (
          <article key={row.playerId} className="leader-row">
            <b>{index + 1}</b><span>{row.name}</span><span>{row.matchPoints} mängud</span><span>{row.bonusPoints} boonused</span><strong>{row.totalPoints}</strong>
            {row.previousRank && row.previousRank !== index + 1 && <small>{row.previousRank > index + 1 ? 'tõus' : 'langus'} kohalt {row.previousRank}</small>}
            <button className="ghost" onClick={() => onSelect(row.playerId)}>Punktid</button>
          </article>
        ))}
      </div>
    </section>
  );
}
