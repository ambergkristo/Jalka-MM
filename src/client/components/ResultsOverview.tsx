import { useEffect, useMemo, useState } from 'react';
import type { Match, Team } from '../../domain/types.js';
import { loadBreakdown } from '../api.js';
import { formatEstoniaKickoffTime, formatMatchDate } from '../lib/date.js';
import { errorEt } from '../lib/messages.js';
import { TeamBadge } from './TeamBadge.js';

export function ResultsOverview({ state, player, onLeaderboard, onDetails, onPredictions, initialBreakdown = [] }: { state: any; player: any; onLeaderboard: () => void; onDetails: () => void; onPredictions: () => void; initialBreakdown?: any[] }) {
  const [breakdown, setBreakdown] = useState<any[]>(initialBreakdown);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!player?.id) return;
    loadBreakdown(player.id).then(setBreakdown).catch((err) => setError(errorEt(err.message)));
  }, [player?.id]);

  const teamsById = useMemo(() => new Map(state.teams.map((team: any) => [team.id, team as Team])), [state.teams]);
  const predictions = useMemo(() => new Map(state.predictions.map((row: any) => [Number(row.match_id), row])), [state.predictions]);
  const results = useMemo(() => new Map(state.results.map((row: any) => [Number(row.match_id), row])), [state.results]);
  const pointsByMatch = useMemo(() => new Map(breakdown.filter((row) => row.item_type === 'match').map((row) => [Number(row.item_id), row])), [breakdown]);
  const leaderboardIndex = state.leaderboard.findIndex((row: any) => row.playerId === player?.id);
  const score = leaderboardIndex >= 0 ? state.leaderboard[leaderboardIndex] : null;
  const totalPoints = score?.totalPoints ?? sumPoints(breakdown);
  const hasResults = state.results.length > 0;

  return (
    <section className="stack">
      <div className="summary results-summary">
        <strong>{totalPoints} punkti</strong>
        <span>{summaryText(state, leaderboardIndex)}</span>
      </div>
      {error && <div className="error">{error}</div>}
      {!hasResults && <div className="empty">Tulemused ilmuvad siia pärast mängude lõppu.</div>}
      <article className="panel">
        <h2>Mängude ülevaade</h2>
        <div className="results-list">
          {state.matches.map((match: Match | any) => (
            <ResultRow key={match.id} match={match} teamsById={teamsById} prediction={predictions.get(match.id)} result={results.get(match.id)} breakdown={pointsByMatch.get(match.id)} />
          ))}
        </div>
      </article>
      <article className="panel">
        <h2>Edetabeli esikolmik</h2>
        {state.leaderboard.length === 0 && <p className="muted">Kinnitatud osalejaid edetabelis veel ei ole.</p>}
        {state.leaderboard.slice(0, 3).map((row: any, index: number) => (
          <div className="mini-leader" key={row.playerId}><b>{index + 1}</b><span>{row.name}</span><strong>{row.totalPoints}p</strong></div>
        ))}
        <div className="panel-actions">
          <button className="ghost" onClick={onLeaderboard}>Vaata kogu edetabelit</button>
          <button className="ghost" onClick={onDetails}>Minu punktid</button>
          <button className="ghost" onClick={onPredictions}>Minu ennustused</button>
        </div>
      </article>
      <p className="muted">Tulemused sisestab korraldaja käsitsi. Rakendus ei kuva automaatset live-andmevoogu.</p>
    </section>
  );
}

function ResultRow({ match, teamsById, prediction, result, breakdown }: { match: any; teamsById: Map<string, Team>; prediction?: any; result?: any; breakdown?: any }) {
  const homeTeam = match.homeTeamId || match.home_team_id ? teamsById.get(match.homeTeamId ?? match.home_team_id) : null;
  const awayTeam = match.awayTeamId || match.away_team_id ? teamsById.get(match.awayTeamId ?? match.away_team_id) : null;
  const kickoff = match.kickoffAt ?? match.kickoff_at;
  return (
    <div className="result-row">
      <div className="match-meta">
        <span>Mäng {match.id}</span>
        <span>{match.stage === 'GROUP' ? formatEstoniaKickoffTime(kickoff) : formatMatchDate(kickoff)}</span>
      </div>
      <div className="result-teams">
        <TeamBadge team={homeTeam} slotLabel={match.homeSlot ?? match.home_slot} />
        <strong>{result ? `${result.home_goals}:${result.away_goals}` : 'Tulemus sisestamata'}</strong>
        <TeamBadge team={awayTeam} slotLabel={match.awaySlot ?? match.away_slot} align="right" />
      </div>
      <div className="result-detail">
        <span>Minu ennustus: {prediction ? `${prediction.home_goals}:${prediction.away_goals}` : 'puudub'}</span>
        <span>{result ? `${Number(breakdown?.points ?? 0)} punkti` : 'Punktid ootavad tulemust'}</span>
      </div>
    </div>
  );
}

function summaryText(state: any, leaderboardIndex: number): string {
  if (state.currentPlayer?.status === 'pending') return 'Sinu osalus ootab korraldaja kinnitust.';
  if (state.currentPlayer?.status === 'disabled') return 'Sinu osalus ei ole ametlikus arvestuses.';
  if (leaderboardIndex >= 0) return `${leaderboardIndex + 1}. koht kinnitatud edetabelis`;
  return 'Ametliku koha arvutamiseks peab korraldaja osaleja kinnitama.';
}

function sumPoints(rows: any[]): number {
  return rows.reduce((sum, row) => sum + Number(row.points ?? 0), 0);
}
