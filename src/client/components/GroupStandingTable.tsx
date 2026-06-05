import type { GroupStanding } from '../data/mock.js';
import { displayTeamName, teamFromName } from '../lib/teamLookup.js';
import { TeamBadge } from './TeamBadge.js';

const stateLabels = {
  qualified: 'Edasipääs',
  'third-place': '3. koht',
  'at-risk': 'Ohus',
  out: 'Väljas'
};

export function GroupStandingTable({ group }: { group: GroupStanding }) {
  return (
    <article className="group-standing-card" id={`group-${group.group.toLowerCase()}`}>
      <header>
        <span>Alagrupp {group.group}</span>
        <strong>{group.teams[0] ? displayTeamName(group.teams[0].team) : ''}</strong>
      </header>
      <div className="group-standing-table" role="table" aria-label={`Alagrupi ${group.group} tabel`}>
        <div className="standing-row standing-head" role="row">
          <span>Võistkond</span>
          <span>M</span>
          <span>V</span>
          <span>Vi</span>
          <span>K</span>
          <span>LV</span>
          <span>LS</span>
          <span>VV</span>
          <span>P</span>
        </div>
        {group.teams.map((team) => (
          <div className={`standing-row state-${team.state}`} role="row" key={team.team}>
            <span className="standing-team">
              <b>{team.rank}</b>
              <TeamBadge team={teamFromName(team.team)} />
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
