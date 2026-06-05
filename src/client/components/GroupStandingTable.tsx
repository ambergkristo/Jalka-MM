import type { GroupStanding } from '../data/mock.js';

const stateLabels = {
  qualified: 'Qualifying',
  'third-place': '3rd race',
  'at-risk': 'At risk',
  out: 'Out'
};

export function GroupStandingTable({ group }: { group: GroupStanding }) {
  return (
    <article className="group-standing-card">
      <header>
        <span>Group {group.group}</span>
        <strong>{group.teams[0]?.team}</strong>
      </header>
      <div className="group-standing-table" role="table" aria-label={`Group ${group.group} standings`}>
        <div className="standing-row standing-head" role="row">
          <span>Team</span>
          <span>P</span>
          <span>W</span>
          <span>D</span>
          <span>L</span>
          <span>GF</span>
          <span>GA</span>
          <span>GD</span>
          <span>Pts</span>
        </div>
        {group.teams.map((team) => (
          <div className={`standing-row state-${team.state}`} role="row" key={team.team}>
            <span className="standing-team">
              <b>{team.rank}</b>
              <span>{team.team}</span>
              <em>{stateLabels[team.state]}</em>
            </span>
            <span>{team.played}</span>
            <span>{team.wins}</span>
            <span>{team.draws}</span>
            <span>{team.losses}</span>
            <span>{team.goalsFor}</span>
            <span>{team.goalsAgainst}</span>
            <span>{team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference}</span>
            <strong>{team.points}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}
