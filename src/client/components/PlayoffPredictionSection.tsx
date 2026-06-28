import { calculateMatchPredictionPoints } from '../../domain/pointsEngine.js';
import type { PublicTournamentState } from '../lib/publicTournamentState.js';
import type { PlayerProfileView, PlayerPlayoffMatchPredictionView } from '../lib/predictionViewModels.js';
import { buildPlayoffBonusRows } from '../lib/playerPlayoffViewModels.js';
import { teamFromName } from '../lib/teamLookup.js';
import { StatusBadge } from './StatusBadge.js';
import { TeamBadge } from './TeamBadge.js';

export function PlayoffPredictionSection({ player, tournamentState }: { player: PlayerProfileView; tournamentState: PublicTournamentState }) {
  const bonusRows = buildPlayoffBonusRows(player, tournamentState);

  return (
    <section className="playoff-prediction-card">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Playoffi ennustus</p>
          <h2>Playoffi tee ja progress</h2>
        </div>
      </div>

      <article className="playoff-subcard">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">R32 ennustus</p>
            <h3>R32 ennustatud mängud</h3>
          </div>
        </div>
        <div className="playoff-match-list">
          {player.playoffPrediction.r32Matches.map((match) => (
            <PlayoffMatchRow key={match.matchId} match={match} tournamentState={tournamentState} />
          ))}
        </div>
      </article>

      <article className="playoff-subcard">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Playoffi tee</p>
            <h3>Voorude kaupa</h3>
          </div>
        </div>
        <div className="playoff-round-grid">
          <RoundCard label="R32" teams={player.playoffPrediction.predictedRoundTeams.r32} />
          <RoundCard label="R16" teams={player.playoffPrediction.predictedRoundTeams.r16} />
          <RoundCard label="Veerandfinaal" teams={player.playoffPrediction.predictedRoundTeams.quarterFinal} />
          <RoundCard label="Poolfinaal" teams={player.playoffPrediction.predictedRoundTeams.semiFinal} />
          <RoundCard label="Finaal" teams={player.playoffPrediction.predictedRoundTeams.final} />
          <RoundCard
            label="3. koha mäng"
            teams={player.playoffPrediction.thirdPlaceMatch ? [player.playoffPrediction.thirdPlaceMatch.homeTeam, player.playoffPrediction.thirdPlaceMatch.awayTeam] : player.playoffPrediction.predictedRoundTeams.thirdPlace}
          />
          <RoundCard label="Meister" teams={[player.playoffPrediction.predictedRoundTeams.champion]} />
        </div>
      </article>

      <article className="playoff-subcard">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Playoffi boonused</p>
            <h3>Boonuste progress</h3>
          </div>
        </div>
        <div className="playoff-bonus-list">
          {bonusRows.map((row) => (
            <div className="playoff-bonus-row" key={row.label}>
              <div className="playoff-bonus-copy">
                <strong>{row.label}</strong>
                <span>Ennustus: {row.predicted}</span>
                <span>Aktuaalne: {row.actual}</span>
              </div>
              <div className="playoff-bonus-meta">
                <b>{row.points} p</b>
                <StatusBadge value={row.status} tone={row.status === 'Täppi' ? 'good' : row.status === 'Möödas' ? 'danger' : 'neutral'} />
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function PlayoffMatchRow({ match, tournamentState }: { match: PlayerPlayoffMatchPredictionView; tournamentState: PublicTournamentState }) {
  const latestResult = tournamentState.latestResults.find((result) => Number(result.id) === match.matchId);
  const liveMatch = tournamentState.liveMatches.find((result) => Number(result.id) === match.matchId);
  const current = latestResult ?? liveMatch;
  const points = latestResult
    ? calculateMatchPredictionPoints(
      {
        playerId: 'player',
        matchId: match.matchId,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        predictedWinner: match.predictedWinner,
        penaltyWinner: match.penaltyWinner
      },
      {
        matchId: match.matchId,
        homeScore: latestResult.homeScore,
        awayScore: latestResult.awayScore,
        isFinal: true
      }
    ).points
    : 0;
  const status = latestResult ? 'Lõppenud' : liveMatch ? 'Otse' : 'Algamas';
  const score = current ? `${current.homeScore}-${current.awayScore}` : matchScore(match);
  const footer = latestResult ? `${points} p` : liveMatch ? 'Hetkeseis' : 'Algamas';

  return (
    <article className="playoff-match-row">
      <div className="playoff-match-topline">
        <span>{`#${match.matchId}`}</span>
        <span>{status}</span>
      </div>
      <div className="playoff-match-teams">
        <TeamBadge team={teamFromName(match.homeTeam)} />
        <div className="playoff-match-score">
          <strong>{score}</strong>
          <small>{footer}</small>
        </div>
        <TeamBadge team={teamFromName(match.awayTeam)} align="right" />
      </div>
    </article>
  );
}

function RoundCard({ label, teams }: { label: string; teams: string[] }) {
  return (
    <article className="playoff-round-card">
      <span>{label}</span>
      <div>
        {teams.length > 0 ? teams.map((team) => <TeamBadge key={`${label}-${team}`} team={teamFromName(team)} />) : <p>Ootel</p>}
      </div>
    </article>
  );
}

function matchScore(match: PlayerPlayoffMatchPredictionView): string {
  return `${match.homeScore}-${match.awayScore}`;
}
