import type { QueryableDatabase } from '../databaseAdapter.js';
import { migrateResultPersistenceSchema } from './resultPersistenceSchema.js';
import type { ResultUpdate } from './resultTypes.js';
import { buildPublicPlayoffBracketTree, type BracketTree } from '../../domain/publicBracket.js';
import { getCurrentLeaderboard } from './resultAgentRuntime.js';
import type { LeaderboardEntry } from '../../domain/predictionRepository.js';
import { buildCountyLeaderboard, type CountyLeaderboardRow } from '../../domain/countyLeaderboard.js';
import { predictionRepository } from '../../domain/predictionRepository.js';
import type { Match } from '../../domain/types.js';
import { touchPublicDashboardRead } from './publicStateHealth.js';
import { backfillTopScorersFromConfirmedResults, rebuildTopScorerStandings } from './topScorerStandings.js';
import { normalizeScorerName } from './scorerNormalization.js';
import { CONFIRMED_FINAL_RESULT_SQL, isConfirmedFinalResult } from './finalizedResultState.js';
import { classifyPublicMatchState } from './publicMatchState.js';
import { derivePublicResultStatus } from './publicResultStatus.js';
import { getPredictionLeagueInsights } from './predictionLeagueInsights.js';
import type { PredictionLeagueInsights } from '../../domain/predictionLeagueInsights.js';
import { getOfficialGroupStageResult, useOfficialGroupStageResults } from './officialGroupStageResults.js';
import { buildCanonicalPlayoffState } from './playoffState.js';

export interface PublicDashboardSnapshot {
  generatedAt: string;
  completedMatchesCount: number;
  totalMatchesCount: number;
  liveMatches: PublicMatchCard[];
  todayMatches: PublicMatchCard[];
  upcomingMatches: PublicMatchCard[];
  nextMatch?: PublicMatchCard;
  latestResults: PublicResultCard[];
  groupStandings: PublicGroupStanding[];
  groupLeaders: Array<{ group: string; team?: string; points?: number; record?: string }>;
  topScorers: PublicTopScorer[];
  playoffBracket: BracketTree;
  tournamentSummary: Array<{ label: string; value: string; detail: string; tone: 'gold' | 'blue' | 'green' | 'red' }>;
  tournamentStats: Array<{ label: string; value: string; detail: string }>;
  tournamentProgressByStage: Array<{ stage: string; completed: number; total: number }>;
  predictionLeagueInsights: PredictionLeagueInsights;
  leaderboard: LeaderboardEntry[];
  countyLeaderboard: CountyLeaderboardRow[];
}

export interface PublicMatchCard {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  kickoffTime: string;
  stage: string;
  status: 'scheduled' | 'live' | 'confirming';
  venue: string;
}

export interface PublicResultCard {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  stage: string;
  winner: string;
  finishedAt: string;
}

export interface PublicGroupStanding {
  group: string;
  teams: Array<{
    rank: number;
    team: string;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    points: number;
    state: 'qualified' | 'third-place' | 'at-risk' | 'out';
  }>;
}

export interface PublicTopScorer {
  rank: number;
  playerId?: string;
  providerPlayerId?: string;
  player: string;
  team: string;
  goals: number;
  assists: number;
}

interface StandingRow {
  groupId: string;
  teamId: string;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export async function getPublicTournamentSnapshot(db: QueryableDatabase, now = new Date()): Promise<PublicDashboardSnapshot> {
  await migrateResultPersistenceSchema(db);
  await touchPublicDashboardRead({ db, now });
  const matches = await getPublicMatches(db, now);
  const confirmedStageCounts = await getConfirmedStageCounts(db);
  const confirmedGroupStageMatches = confirmedStageCounts.GROUP ?? 0;
  const shouldUseOfficialGroupResults = useOfficialGroupStageResults(confirmedGroupStageMatches);
  const playoffState = await buildCanonicalPlayoffState({
    now,
    confirmedGroupStageMatches
  });
  const latestResults = await getConfirmedLatestResults(db, shouldUseOfficialGroupResults);
  const resultSummary = await getConfirmedResultSummary(db, shouldUseOfficialGroupResults);
  const groupStandings = await getPublicGroupStandings(db, shouldUseOfficialGroupResults);
  const topScorers = await getPublicTopScorers(db);
  const leaderboard = await getCurrentLeaderboard();
  const countyLeaderboard = buildCountyLeaderboard({
    players: predictionRepository.getPlayers(),
    leaderboardEntries: leaderboard.entries
  });
  const predictionLeagueInsights = await getPredictionLeagueInsights(db, leaderboard.entries, now);
  const totalMatches = Number((await db.one('SELECT COUNT(*) AS count FROM matches'))?.count ?? 104);
  const completed = resultSummary.completedMatchesCount;
  const goals = resultSummary.totalGoals;
  const liveMatches = playoffState.groupStageComplete
    ? playoffState.fixtures.filter((fixture) => fixture.status === 'live').map(toPlayoffMatchCard)
    : matches.filter((match) => match.state === 'live').map(toMatchCard);
  const todayMatches = playoffState.groupStageComplete
    ? []
    : matches.filter((match) => match.state === 'today').map(toMatchCard);
  const upcomingMatches = playoffState.groupStageComplete
    ? playoffState.fixtures.filter((fixture) => fixture.status === 'scheduled').map(toPlayoffMatchCard)
    : matches.filter((match) => match.state === 'upcoming').map(toMatchCard);
  const nextMatch = playoffState.groupStageComplete ? upcomingMatches[0] : findNextMatch(matches, now);
  const groupLeaders = groupStandings.map((group) => {
    const leader = group.teams[0];
    return {
      group: group.group,
      team: leader?.played ? leader.team : undefined,
      points: leader?.played ? leader.points : undefined,
      record: leader?.played ? `${leader.wins}-${leader.draws}-${leader.losses}` : undefined
    };
  });
  const tournamentProgressByStage = buildTournamentProgressByStage(confirmedStageCounts);
  const tournamentSummary = buildTournamentSummary({
    completed,
    totalMatches,
    goals,
    playoffState,
    upcomingMatchesCount: upcomingMatches.length,
    liveMatchesCount: liveMatches.length
  });

  return {
    generatedAt: now.toISOString(),
    completedMatchesCount: completed,
    totalMatchesCount: totalMatches,
    liveMatches,
    todayMatches,
    upcomingMatches,
    nextMatch,
    latestResults,
    groupStandings,
    groupLeaders,
    topScorers,
    playoffBracket: buildPublicPlayoffBracketTree({ fixturesByMatchId: playoffState.bracketFixturesByMatchId }),
    leaderboard: leaderboard.entries,
    countyLeaderboard,
    tournamentSummary,
    tournamentStats: [
      { label: 'VĆ¤ravaid kokku', value: String(goals), detail: `${completed} lĆµppenud mĆ¤nguga` },
      { label: 'Keskmine', value: completed > 0 ? formatDecimal(goals / completed) : '0,00', detail: 'vĆ¤ravat mĆ¤ngu kohta' },
      { label: 'NullimĆ¤ngud', value: String(countCleanSheets(latestResults)), detail: 'Kinnitatud tulemuste pĆµhjal' },
      { label: 'Suurim vĆµit', value: biggestWin(latestResults), detail: 'Kinnitatud tulemuste pĆµhjal' },
      { label: 'VĆ¤ravaterohkeim', value: highestScoringMatch(latestResults), detail: 'Kinnitatud tulemuste pĆµhjal' }
    ],
    tournamentProgressByStage,
    predictionLeagueInsights
  };
}

export async function getPublicResultsPayload(db: QueryableDatabase, now = new Date()): Promise<{
  generatedAt: string;
  completedMatchesCount: number;
  liveMatches: PublicMatchCard[];
  todayMatches: PublicMatchCard[];
  nextMatch?: PublicMatchCard;
  upcomingMatches: PublicMatchCard[];
  confirmedResults: PublicResultCard[];
}> {
  const snapshot = await getPublicTournamentSnapshot(db, now);
  return {
    generatedAt: snapshot.generatedAt,
    completedMatchesCount: snapshot.completedMatchesCount,
    liveMatches: snapshot.liveMatches,
    todayMatches: snapshot.todayMatches,
    nextMatch: snapshot.nextMatch,
    upcomingMatches: snapshot.upcomingMatches,
    confirmedResults: snapshot.latestResults
  };
}

export async function getPublicTournamentPayload(db: QueryableDatabase, now = new Date()): Promise<{
  generatedAt: string;
  completedMatchesCount: number;
  liveMatches: PublicMatchCard[];
  todayMatches: PublicMatchCard[];
  nextMatch?: PublicMatchCard;
  groupStandings: PublicGroupStanding[];
  topScorers: PublicTopScorer[];
  playoffBracket: BracketTree;
  tournamentSummary: PublicDashboardSnapshot['tournamentSummary'];
  tournamentStats: PublicDashboardSnapshot['tournamentStats'];
  tournamentProgressByStage: PublicDashboardSnapshot['tournamentProgressByStage'];
  predictionLeagueInsights: PublicDashboardSnapshot['predictionLeagueInsights'];
  countyLeaderboard: CountyLeaderboardRow[];
}> {
  const snapshot = await getPublicTournamentSnapshot(db, now);
  return {
    generatedAt: snapshot.generatedAt,
    completedMatchesCount: snapshot.completedMatchesCount,
    liveMatches: snapshot.liveMatches,
    todayMatches: snapshot.todayMatches,
    nextMatch: snapshot.nextMatch,
    groupStandings: snapshot.groupStandings,
    topScorers: snapshot.topScorers,
    playoffBracket: snapshot.playoffBracket,
    tournamentSummary: snapshot.tournamentSummary,
    tournamentStats: snapshot.tournamentStats,
    tournamentProgressByStage: snapshot.tournamentProgressByStage,
    predictionLeagueInsights: snapshot.predictionLeagueInsights,
    countyLeaderboard: snapshot.countyLeaderboard
  };
}

export async function refreshDerivedTournamentTables(db: QueryableDatabase, now: Date, topScorers: PublicTopScorer[] = []): Promise<void> {
  await migrateResultPersistenceSchema(db);
  const standings = await buildGroupStandingsRows(db);
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM group_standings');
    for (const group of standings) {
      for (const team of group.teams) {
        const teamId = await teamIdForName(tx, team.team);
        if (!teamId) continue;
        await tx.run(
          `INSERT INTO group_standings (
            group_id, team_id, rank, played, wins, draws, losses, goals_for, goals_against, goal_difference, points, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [group.group, teamId, team.rank, team.played, team.wins, team.draws, team.losses, team.goalsFor, team.goalsAgainst, team.goalDifference, team.points, now.toISOString()]
        );
      }
    }

    await tx.run('DELETE FROM top_scorer_standings');
    for (const scorer of topScorers) {
      const teamId = await teamIdForName(tx, scorer.team);
      await tx.run(
        `INSERT INTO top_scorer_standings (id, rank, player_id, provider_player_id, player_name, team_id, goals, assists, minutes_played, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `${scorer.rank}-${scorer.playerId ?? scorer.providerPlayerId ?? slug(scorer.player)}`,
          scorer.rank,
          scorer.playerId ?? null,
          scorer.providerPlayerId ?? null,
          scorer.player,
          teamId ?? null,
          scorer.goals,
          scorer.assists,
          null,
          now.toISOString()
        ]
      );
    }
  });
}

export async function resetPublicTournamentRuntimeState(db: QueryableDatabase): Promise<void> {
  await migrateResultPersistenceSchema(db);
  await db.exec(`
    DELETE FROM top_scorer_standings;
    DELETE FROM result_manual_scorers;
    DELETE FROM result_manual_corrections;
    DELETE FROM group_standings;
    DELETE FROM leaderboard_metadata;
    DELETE FROM leaderboard_entries;
    DELETE FROM result_updates;
    DELETE FROM match_results;
    DELETE FROM result_agent_runs;
    DELETE FROM public_state_metadata;
  `);
}

async function getConfirmedLatestResults(db: QueryableDatabase, shouldUseOfficialGroupResults = false): Promise<PublicResultCard[]> {
  const rows = await db.all(`
    SELECT
      m.id,
      m.stage,
      m.group_id,
      m.kickoff_at,
      COALESCE(home.name, m.home_slot) AS home_team,
      COALESCE(away.name, m.away_slot) AS away_team,
      r.confirmed_home_score,
      r.confirmed_away_score,
      r.confirmed_at
    FROM match_results r
    JOIN matches m ON m.id = r.match_id
    LEFT JOIN teams home ON home.id = m.home_team_id
    LEFT JOIN teams away ON away.id = m.away_team_id
    WHERE ${CONFIRMED_FINAL_RESULT_SQL}
    ORDER BY COALESCE(r.confirmed_at, r.last_checked_at) DESC, m.id DESC
    LIMIT 8
  `);
  return rows.map((row) => {
    const resolvedScore = resolveConfirmedScore(
      Number(row.id),
      Number(row.confirmed_home_score),
      Number(row.confirmed_away_score),
      shouldUseOfficialGroupResults
    );
    const homeScore = resolvedScore.homeScore;
    const awayScore = resolvedScore.awayScore;
    const homeTeam = String(row.home_team);
    const awayTeam = String(row.away_team);
    return {
      id: String(row.id),
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      stage: row.group_id ? `Alagrupp ${row.group_id}` : stageLabel(row.stage as Match['stage']),
      winner: homeScore === awayScore ? 'Draw' : homeScore > awayScore ? homeTeam : awayTeam,
      finishedAt: formatTallinnDateTime(String(row.confirmed_at ?? row.kickoff_at))
    };
  });
}

async function getConfirmedResultSummary(db: QueryableDatabase, shouldUseOfficialGroupResults = false): Promise<{ completedMatchesCount: number; totalGoals: number }> {
  const rows = await db.all(`
    SELECT
      m.id,
      r.confirmed_home_score,
      r.confirmed_away_score
    FROM match_results r
    JOIN matches m ON m.id = r.match_id
    WHERE ${CONFIRMED_FINAL_RESULT_SQL}
  `);
  return rows.reduce<{ completedMatchesCount: number; totalGoals: number }>((summary, row) => {
    const resolvedScore = resolveConfirmedScore(
      Number(row.id),
      Number(row.confirmed_home_score),
      Number(row.confirmed_away_score),
      shouldUseOfficialGroupResults
    );
    return {
      completedMatchesCount: summary.completedMatchesCount + 1,
      totalGoals: summary.totalGoals + resolvedScore.homeScore + resolvedScore.awayScore
    };
  }, { completedMatchesCount: 0, totalGoals: 0 });
}

async function getConfirmedStageCounts(db: QueryableDatabase): Promise<Partial<Record<Match['stage'], number>>> {
  const rows = await db.all(`
    SELECT m.stage, COUNT(*) AS count
    FROM match_results r
    JOIN matches m ON m.id = r.match_id
    WHERE ${CONFIRMED_FINAL_RESULT_SQL}
    GROUP BY m.stage
  `);
  return rows.reduce<Partial<Record<Match['stage'], number>>>((counts, row) => {
    counts[row.stage as Match['stage']] = Number(row.count ?? 0);
    return counts;
  }, {});
}

async function getUpcomingMatches(db: QueryableDatabase, now = new Date()): Promise<PublicMatchCard[]> {
  return (await getPublicMatches(db, now))
    .filter((match) => match.state === 'upcoming')
    .map(toMatchCard);
}

async function getPublicMatches(db: QueryableDatabase, now: Date): Promise<Array<{
  id: number;
  stage: Match['stage'];
  groupId?: string;
  kickoffAt: string;
  homeTeam: string;
  awayTeam: string;
  publicStatus: string;
  homeScore?: number;
  awayScore?: number;
  state: 'live' | 'today' | 'upcoming';
}>> {
  const rows = await db.all(`
    SELECT
      m.id,
      m.stage,
      m.group_id,
      m.kickoff_at,
      COALESCE(home.name, m.home_slot) AS home_team,
      COALESCE(away.name, m.away_slot) AS away_team,
      r.status,
      r.provisional_status,
      r.confirmation_confidence,
      r.next_confirmation_check_at,
      r.needs_review_reason,
      r.raw_provider_status,
      r.is_final,
      r.home_score,
      r.away_score,
      r.provisional_home_score,
      r.provisional_away_score
    FROM matches m
    LEFT JOIN match_results r ON r.match_id = m.id
    LEFT JOIN teams home ON home.id = m.home_team_id
    LEFT JOIN teams away ON away.id = m.away_team_id
    ORDER BY m.kickoff_at, m.id
  `);
  return rows.flatMap((row) => {
    const kickoffAt = String(row.kickoff_at);
    if (Number.isNaN(Date.parse(kickoffAt))) return [];
    if (isConfirmedFinalResult(row)) return [];
    const publicStatus = derivePublicResultStatus(row);
    const state = classifyPublicMatchState({
      kickoffAt,
      publicStatus,
      isConfirmedFinal: false,
      now
    });
    if (state === 'finished' || state === 'stale') return [];
    const score = state === 'live'
      ? publicLiveScore(row.provisional_home_score ?? row.home_score, row.provisional_away_score ?? row.away_score)
      : {};
    return [{
      id: Number(row.id),
      stage: row.stage as Match['stage'],
      groupId: row.group_id ? String(row.group_id) : undefined,
      kickoffAt,
      homeTeam: String(row.home_team),
      awayTeam: String(row.away_team),
      publicStatus,
      ...score,
      state
    }];
  });
}

function findNextMatch(matches: Array<{
  id: number;
  stage: Match['stage'];
  groupId?: string;
  kickoffAt: string;
  homeTeam: string;
  awayTeam: string;
  publicStatus: string;
  homeScore?: number;
  awayScore?: number;
  state: 'live' | 'today' | 'upcoming';
}>, now: Date): PublicMatchCard | undefined {
  const nextMatch = matches.find((match) =>
    match.publicStatus === 'SCHEDULED' &&
    Date.parse(match.kickoffAt) > now.getTime()
  );
  return nextMatch ? toMatchCard(nextMatch) : undefined;
}

function toMatchCard(match: {
  id: number;
  stage: Match['stage'];
  groupId?: string;
  kickoffAt: string;
  homeTeam: string;
  awayTeam: string;
  publicStatus: string;
  homeScore?: number;
  awayScore?: number;
  state: 'live' | 'today' | 'upcoming';
}): PublicMatchCard {
  return {
    id: String(match.id),
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    ...(match.homeScore === undefined || match.awayScore === undefined ? {} : {
      homeScore: match.homeScore,
      awayScore: match.awayScore
    }),
    kickoffTime: formatTallinnDateTime(match.kickoffAt),
    stage: match.groupId ? `Alagrupp ${match.groupId}` : stageLabel(match.stage),
    status: match.state === 'live' ? 'live' : publicMatchStatus(match.publicStatus),
    venue: ''
  };
}

function toPlayoffMatchCard(match: {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  kickoffAt?: string;
  stage: Match['stage'];
  status: 'scheduled' | 'live' | 'finished';
  venue?: string;
  homeScore?: number;
  awayScore?: number;
}): PublicMatchCard {
  return {
    id: String(match.matchId),
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    ...(match.homeScore === undefined || match.awayScore === undefined ? {} : {
      homeScore: match.homeScore,
      awayScore: match.awayScore
    }),
    kickoffTime: match.kickoffAt ? formatTallinnDateTime(match.kickoffAt) : 'TBC',
    stage: stageLabel(match.stage),
    status: match.status === 'live' ? 'live' : match.status === 'finished' ? 'confirming' : 'scheduled',
    venue: match.venue ?? ''
  };
}

function publicLiveScore(homeValue: unknown, awayValue: unknown): { homeScore?: number; awayScore?: number } {
  const homeScore = publicScoreNumber(homeValue);
  const awayScore = publicScoreNumber(awayValue);
  if (homeScore === undefined || awayScore === undefined) return {};
  return { homeScore, awayScore };
}

function publicScoreNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const score = Number(value);
  if (!Number.isInteger(score) || score < 0) return undefined;
  return score;
}

async function getPublicGroupStandings(db: QueryableDatabase, shouldUseOfficialGroupResults = false): Promise<PublicGroupStanding[]> {
  return buildGroupStandingsRows(db, shouldUseOfficialGroupResults);
}

async function buildGroupStandingsRows(db: QueryableDatabase, shouldUseOfficialGroupResults = false): Promise<PublicGroupStanding[]> {
  const teams = await db.all('SELECT id, name, group_id FROM teams WHERE group_id IS NOT NULL ORDER BY group_id, id');
  const standings = new Map<string, StandingRow>();
  for (const team of teams) {
    const groupId = String(team.group_id);
    const teamId = String(team.id);
    standings.set(teamId, {
      groupId,
      teamId,
      teamName: String(team.name),
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0
    });
  }

  const results = await db.all(`
    SELECT m.id AS match_id, m.home_team_id, m.away_team_id, r.confirmed_home_score, r.confirmed_away_score
    FROM match_results r
    JOIN matches m ON m.id = r.match_id
    WHERE ${CONFIRMED_FINAL_RESULT_SQL} AND m.stage = 'GROUP'
  `);

  for (const result of results) {
    const home = standings.get(String(result.home_team_id));
    const away = standings.get(String(result.away_team_id));
    if (!home || !away) continue;
    const resolvedScore = resolveConfirmedScore(
      Number(result.match_id ?? 0),
      Number(result.confirmed_home_score),
      Number(result.confirmed_away_score),
      shouldUseOfficialGroupResults
    );
    applyResult(home, resolvedScore.homeScore, resolvedScore.awayScore);
    applyResult(away, resolvedScore.awayScore, resolvedScore.homeScore);
  }

  const groups = [...new Set([...standings.values()].map((row) => row.groupId))].sort();
  return groups.map((group) => {
    const rows = [...standings.values()]
      .filter((row) => row.groupId === group)
      .sort((a, b) =>
        b.points - a.points ||
        goalDifference(b) - goalDifference(a) ||
        b.goalsFor - a.goalsFor ||
        a.teamName.localeCompare(b.teamName)
      );
    return {
      group,
      teams: rows.map((row, index) => ({
        rank: index + 1,
        team: row.teamName,
        played: row.played,
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDifference: goalDifference(row),
        points: row.points,
        state: row.played === 0 ? 'at-risk' : index < 2 ? 'qualified' : index === 2 ? 'third-place' : 'at-risk'
      }))
    };
  });
}

async function getPublicTopScorers(db: QueryableDatabase): Promise<PublicTopScorer[]> {
  const cachedRows = await db.all(`
    SELECT
      t.rank,
      t.player_id,
      t.provider_player_id,
      t.player_name,
      COALESCE(team.name, team.name_et, t.team_id, '') AS team_name,
      t.goals,
      t.assists
    FROM top_scorer_standings t
    LEFT JOIN teams team ON team.id = t.team_id
    ORDER BY t.rank ASC, t.player_name ASC
    LIMIT 20
  `);
  if (cachedRows.length > 0) {
    const confirmedGoalsCount = Number((await db.one(`
      SELECT COALESCE(SUM(COALESCE(confirmed_home_score, home_score, 0) + COALESCE(confirmed_away_score, away_score, 0)), 0) AS total
      FROM match_results
      WHERE ${CONFIRMED_FINAL_RESULT_SQL}
    `))?.total ?? 0);
    const topScorerGoalsCount = cachedRows.reduce((sum, row) => sum + Number(row.goals ?? 0), 0);
    const hasNameAnomaly = cachedRows.some((row) => normalizeScorerName(String(row.player_name ?? '')) !== String(row.player_name ?? '').trim());
    const scorerFactsCount = Number((await db.one('SELECT COUNT(*) AS count FROM result_manual_scorers'))?.count ?? 0);
    if (
      hasNameAnomaly ||
      (confirmedGoalsCount > 0 && topScorerGoalsCount > confirmedGoalsCount) ||
      (confirmedGoalsCount > 0 && scorerFactsCount === 0)
    ) {
      try {
        await backfillTopScorersFromConfirmedResults(db, new Date().toISOString());
      } catch {
        // keep the best available cache state if the repair path is unavailable
      }
      const repairedRows = await db.all(`
        SELECT
          t.rank,
          t.player_id,
          t.provider_player_id,
          t.player_name,
          COALESCE(team.name, team.name_et, t.team_id, '') AS team_name,
          t.goals,
          t.assists
        FROM top_scorer_standings t
        LEFT JOIN teams team ON team.id = t.team_id
        ORDER BY t.rank ASC, t.player_name ASC
        LIMIT 20
      `);
      if (repairedRows.length > 0) {
        return repairedRows.map((row) => ({
          rank: Number(row.rank),
          playerId: stringOrUndefined(row.player_id),
          providerPlayerId: stringOrUndefined(row.provider_player_id),
          player: String(row.player_name),
          team: String(row.team_name ?? ''),
          goals: Number(row.goals),
          assists: Number(row.assists ?? 0)
        }));
      }
    }
    return cachedRows.map((row) => ({
      rank: Number(row.rank),
      playerId: stringOrUndefined(row.player_id),
      providerPlayerId: stringOrUndefined(row.provider_player_id),
      player: String(row.player_name),
      team: String(row.team_name ?? ''),
      goals: Number(row.goals),
      assists: Number(row.assists ?? 0)
    }));
  }

  const scorerFactsCount = Number((await db.one('SELECT COUNT(*) AS count FROM result_manual_scorers'))?.count ?? 0);
  if (scorerFactsCount === 0) {
    const confirmedResultsCount = Number((await db.one(`
      SELECT COUNT(*) AS count
      FROM match_results
      WHERE ${CONFIRMED_FINAL_RESULT_SQL}
    `))?.count ?? 0);
    if (confirmedResultsCount > 0) {
      try {
        await backfillTopScorersFromConfirmedResults(db, new Date().toISOString());
      } catch {
        // Fall back to the empty state or any manual scorer facts already stored.
      }
    }
  } else {
    try {
      await rebuildTopScorerStandings(db, new Date().toISOString());
    } catch {
      // Fall back to the manual scorer facts if the cache rebuild is unavailable.
    }
  }

  const repairedRows = await db.all(`
    SELECT
      t.rank,
      t.player_id,
      t.provider_player_id,
      t.player_name,
      COALESCE(team.name, team.name_et, t.team_id, '') AS team_name,
      t.goals,
      t.assists
    FROM top_scorer_standings t
    LEFT JOIN teams team ON team.id = t.team_id
    ORDER BY t.rank ASC, t.player_name ASC
    LIMIT 20
  `);
  if (repairedRows.length > 0) {
    return repairedRows.map((row) => ({
      rank: Number(row.rank),
      playerId: stringOrUndefined(row.player_id),
      providerPlayerId: stringOrUndefined(row.provider_player_id),
      player: String(row.player_name),
      team: String(row.team_name ?? ''),
      goals: Number(row.goals),
      assists: Number(row.assists ?? 0)
    }));
  }

  const fallbackRows = await db.all(`
    SELECT
      grouped.player_name,
      grouped.player_id,
      grouped.provider_player_id,
      grouped.goals,
      grouped.team_name
    FROM (
      SELECT
        facts.player_id AS player_id,
        facts.provider_player_id AS provider_player_id,
        facts.player_name AS player_name,
        SUM(facts.goals) AS goals,
        COALESCE(t.name, t.name_et, facts.team_id, '') AS team_name
      FROM result_manual_scorers facts
      LEFT JOIN teams t ON t.id = facts.team_id
      WHERE facts.player_name <> 'manual_unknown_scorer'
      GROUP BY facts.player_id, facts.provider_player_id, facts.player_name, facts.team_id, COALESCE(t.name, t.name_et, facts.team_id, '')
    ) grouped
    ORDER BY grouped.goals DESC, grouped.player_name ASC, grouped.team_name ASC
    LIMIT 20
  `);
  return fallbackRows.map((row, index) => ({
    rank: index + 1,
    playerId: stringOrUndefined(row.player_id),
    providerPlayerId: stringOrUndefined(row.provider_player_id),
    player: String(row.player_name),
    team: String(row.team_name ?? ''),
    goals: Number(row.goals),
    assists: 0
  }));
}

function applyResult(row: StandingRow, goalsFor: number, goalsAgainst: number): void {
  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  if (goalsFor > goalsAgainst) {
    row.wins += 1;
    row.points += 3;
  } else if (goalsFor === goalsAgainst) {
    row.draws += 1;
    row.points += 1;
  } else {
    row.losses += 1;
  }
}

function goalDifference(row: StandingRow): number {
  return row.goalsFor - row.goalsAgainst;
}

async function teamIdForName(db: QueryableDatabase, teamName: string): Promise<string | undefined> {
  const row = await db.one('SELECT id FROM teams WHERE id = ? OR name = ? OR name_et = ? LIMIT 1', [teamName, teamName, teamName]);
  return row?.id ? String(row.id) : undefined;
}

function countCleanSheets(results: PublicResultCard[]): number {
  return results.reduce((count, result) => count + (result.homeScore === 0 ? 1 : 0) + (result.awayScore === 0 ? 1 : 0), 0);
}

function biggestWin(results: PublicResultCard[]): string {
  if (results.length === 0) return 'Puudub';
  const result = [...results].sort((a, b) => Math.abs(b.homeScore - b.awayScore) - Math.abs(a.homeScore - a.awayScore))[0];
  return `${result.homeTeam} ${result.homeScore}-${result.awayScore}`;
}

function highestScoringMatch(results: PublicResultCard[]): string {
  if (results.length === 0) return 'Puudub';
  const result = [...results].sort((a, b) => (b.homeScore + b.awayScore) - (a.homeScore + a.awayScore))[0];
  return `${result.homeTeam} ${result.homeScore}-${result.awayScore} ${result.awayTeam}`;
}

function formatDateTime(value: string): string {
  const date = new Intl.DateTimeFormat('et-EE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Tallinn' }).format(new Date(value)).replace(/\.$/, '');
  const time = new Intl.DateTimeFormat('et-EE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Tallinn' }).format(new Date(value));
  return `${date} ā€¢ ${time}`;
}

function formatDecimal(value: number): string {
  return value.toLocaleString('et-EE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTallinnDateTime(value: string): string {
  const date = new Intl.DateTimeFormat('et-EE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Tallinn' }).format(new Date(value)).replace(/\.$/, '');
  const time = new Intl.DateTimeFormat('et-EE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Tallinn' }).format(new Date(value));
  return `${date} ${time}`;
}

function resolveConfirmedScore(
  matchId: number,
  homeScore: number,
  awayScore: number,
  shouldUseOfficialGroupResults: boolean
): { homeScore: number; awayScore: number } {
  if (!shouldUseOfficialGroupResults) {
    return { homeScore, awayScore };
  }
  return getOfficialGroupStageResult(matchId) ?? { homeScore, awayScore };
}

function buildTournamentSummary(input: {
  completed: number;
  totalMatches: number;
  goals: number;
  playoffState: { groupStageComplete: boolean; r32FixturesKnownCount: number };
  upcomingMatchesCount: number;
  liveMatchesCount: number;
}): PublicDashboardSnapshot['tournamentSummary'] {
  const phaseValue = input.playoffState.groupStageComplete ? 'Play-off' : 'Alagrupid';
  const phaseDetail = input.playoffState.groupStageComplete
    ? input.liveMatchesCount > 0
      ? 'Play-off kohtumised on kĆ¤imas'
      : input.upcomingMatchesCount > 0
        ? 'R32 kohtumised on jĆ¤rjekorras'
        : 'Play-off ajakava uueneb'
    : input.completed > 0
      ? 'Turniir on alanud'
      : 'AvamĆ¤ngu ootel';
  const teamDetail = input.playoffState.groupStageComplete
    ? `${input.playoffState.r32FixturesKnownCount} / 16 R32 paari on teada`
    : 'Alagrupid A-L';

  return [
    { label: 'Turniiri faas', value: phaseValue, detail: phaseDetail, tone: 'gold' },
    { label: 'MĆ¤ngitud', value: `${input.completed} / ${input.totalMatches}`, detail: `${Math.max(input.totalMatches - input.completed, 0)} kohtumist on veel ees`, tone: 'blue' },
    { label: 'VĆ¤ravad', value: String(input.goals), detail: input.completed > 0 ? `${formatDecimal(input.goals / input.completed)} vĆ¤ravat mĆ¤ngu kohta` : 'Kinnitatud vĆ¤ravaid veel ei ole', tone: 'green' },
    { label: 'VĆµistkonnad', value: '48', detail: teamDetail, tone: 'red' }
  ];
}

function buildTournamentProgressByStage(confirmedStageCounts: Partial<Record<Match['stage'], number>>): PublicDashboardSnapshot['tournamentProgressByStage'] {
  return [
    { stage: 'Alagrupid', completed: confirmedStageCounts.GROUP ?? 0, total: 72 },
    { stage: '1/16-finaalid', completed: confirmedStageCounts.R32 ?? 0, total: 16 },
    { stage: 'Kaheksandikfinaalid', completed: confirmedStageCounts.R16 ?? 0, total: 8 },
    { stage: 'Veerandfinaalid', completed: confirmedStageCounts.QF ?? 0, total: 4 },
    { stage: 'Poolfinaalid', completed: confirmedStageCounts.SF ?? 0, total: 2 },
    { stage: '3. koha mĆ¤ng', completed: confirmedStageCounts.THIRD_PLACE ?? 0, total: 1 },
    { stage: 'Finaal', completed: confirmedStageCounts.FINAL ?? 0, total: 1 }
  ];
}

function stageLabel(stage: Match['stage']): string {
  return {
    GROUP: 'Alagrupid',
    R32: 'R32',
    R16: 'R16',
    QF: 'Veerandfinaal',
    SF: 'Poolfinaal',
    THIRD_PLACE: '3. koha mĆ¤ng',
    FINAL: 'Finaal'
  }[stage];
}

function publicMatchStatus(publicStatus: string): PublicMatchCard['status'] {
  if (publicStatus === 'LIVE') return 'live';
  if (publicStatus === 'CONFIRMING' || publicStatus === 'NEEDS_REVIEW') return 'confirming';
  return 'scheduled';
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function stringOrUndefined(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return String(value);
}


