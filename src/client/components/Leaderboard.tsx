export function Leaderboard({ state, onSelect }: { state: any; onSelect: (playerId: string) => void }) {
  const leader = state.leaderboard[0];
  return (
    <section>
      <div className="summary"><strong>{leader?.name ?? 'No leader yet'}</strong><span>Last updated {new Date(state.lastUpdated).toLocaleTimeString()}</span></div>
      <div className="leaderboard">
        {state.leaderboard.map((row: any, index: number) => (
          <article key={row.playerId} className="leader-row">
            <b>{index + 1}</b><span>{row.name}</span><span>{row.matchPoints} match</span><span>{row.bonusPoints} bonus</span><strong>{row.totalPoints}</strong>
            {row.previousRank && row.previousRank !== index + 1 && <small>{row.previousRank > index + 1 ? 'up' : 'down'} from {row.previousRank}</small>}
            <button className="ghost" onClick={() => onSelect(row.playerId)}>Details</button>
          </article>
        ))}
      </div>
    </section>
  );
}
