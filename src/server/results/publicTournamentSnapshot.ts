import type { QueryableDatabase, QueryValue } from '../databaseAdapter.js';
import { migrateResultPersistenceSchema } from './resultPersistenceSchema.js';
import type { ResultUpdate } from './resultTypes.js';
import { buildPublicPlayoffBracketTree, type BracketTree } from '../../domain/publicBracket.js';
import { getCurrentLeaderboard } from './resultAgentRuntime.js';
import type { LeaderboardEntry } from '../../domain/predictionRepository.js';

export interface PublicDashboardSnapshot {
  liveMatches: PublicMatchCard[];
  todayMatches: PublicMatchCard[];
  upcomingMatches: PublicMatchCard[];
  latestResults: PublicResultCard[];
  groupStandings: PublicGroupStanding[];
  groupLeaders: Array<{ group: string; team?: string; points?: number; record?: string }>;
  topScorers: PublicTopScorer[];
  playoffBracket: BracketTree;
  tournamentSummary: Array<{ label: string; value: string; detail: string; tone: 'gold' | 'blue' | 'green' | 'red' }>;
  tournamentStats: Array<{ label: string; value: string; detail: string }>;
  tournamentProgressByStage: Array<{ stage: string; completed: number; total: number }>;
  leaderboard: LeaderboardEntry[];
}

export interface PublicMatchCard {
  id: string;
  homeTeam: string;
  awayTeam: string;
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

export async function getPublicTournamentSnapshot(db: QueryableDatabase): Promise<PublicDashboardSnapshot> {
  await migrateResultPersistenceSchema(db);
  const matches = await getPublicMatches(db);
  const liveMatches = matches.filter((match) => match.state === 'live').map(toMatchCard);
  const todayMatches = matches.filter((match) => match.state === 'today').map(toMatchCard);
  const upcomingMatches = matches.filter((match) => match.state === 'upcoming').map(toMatchCard);
  const latestResults = await getConfirmedLatestResults(db);
  const groupStandings = await getPublicGroupStandings(db);
  const topScorers = await getPublicTopScorers(db);
  const leaderboard = await getCurrentLeaderboard();
  const completed = latestResults.length;
  const totalMatches = Number((await db.one('SELECT COUNT(*) AS count FROM matches'))?.count ?? 104);
  const goals = latestResults.reduce((sum, result) => sum + result.homeScore + result.awayScore, 0);
  const groupLeaders = groupStandings.map((group) => {
    const leader = group.teams[0];
    return {
      group: group.group,
      team: leader?.played ? leader.team : undefined,
      points: leader?.played ? leader.points : undefined,
      record: leader?.played ? `${leader.wins}-${leader.draws}-${leader.losses}` : undefined
    };
  });

  return {
    liveMatches,
    todayMatches,
    upcomingMatches,
    latestResults,
    groupStandings,
    groupLeaders,
    topScorers,
    playoffBracket: buildPublicPlayoffBracketTree(),
    leaderboard: leaderboard.entries,
    tournamentSummary: [
      { label: 'Turniiri faas', value: 'Alagrupid', detail: completed > 0 ? 'Turniir on alanud' : 'Avamängu ootel', tone: 'gold' },
      { label: 'Mängitud', value: `${completed} / ${totalMatches}`, detail: `${Math.max(totalMatches - completed, 0)} kohtumist on veel ees`, tone: 'blue' },
      { label: 'Väravad', value: String(goals), detail: completed > 0 ? `${formatDecimal(goals / completed)} väravat mängu kohta` : 'Kinnitatud väravaid veel ei ole', tone: 'green' },
      { label: 'Võistkonnad', value: '48', detail: 'Alagrupid A-L', tone: 'red' }
    ],
    tournamentStats: [
      { label: 'Väravaid kokku', value: String(goals), detail: `${completed} lõppenud mänguga` },
      { label: 'Keskmine', value: completed > 0 ? formatDecimal(goals / completed) : '0,00', detail: 'väravat mängu kohta' },
      { label: 'Nullimängud', value: String(countCleanSheets(latestResults)), detail: 'Kinnitatud tulemuste põhjal' },
      { label: 'Suurim võit', value: biggestWin(latestResults), detail: 'Kinnitatud tulemuste põhjal' },
      { label: 'Väravaterohkeim', value: highestScoringMatch(latestResults), detail: 'Kinnitatud tulemuste põhjal' }
    ],
    tournamentProgressByStage: [
      { stage: 'Alagrupid', completed, total: 72 },
      { stage: '1/16-finaalid', completed: 0, total: 16 },
      { stage: 'Kaheksandikfinaalid', completed: 0, total: 8 },
      { stage: 'Veerandfinaalid', completed: 0, total: 4 },
      { stage: 'Poolfinaalid', completed: 0, total: 2 },
      { stage: 'Finaalid', completed: 0, total: 2 }
    ]
  };
}

export async function getPublicResultsPayload(db: QueryableDatabase): Promise<{
  upcomingMatches: PublicMatchCard[];
  confirmedResults: PublicResultCard[];
}> {
  const snapshot = await getPublicTournamentSnapshot(db);
  return {
    upcomingMatches: snapshot.upcomingMatches,
    confirmedResults: snapshot.latestResults
  };
}

export async function getPublicTournamentPayload(db: QueryableDatabase): Promise<{
  groupStandings: PublicGroupStanding[];
  topScorers: PublicTopScorer[];
  playoffBracket: BracketTree;
  tournamentSummary: PublicDashboardSnapshot['tournamentSummary'];
  tournamentStats: PublicDashboardSnapshot['tournamentStats'];
  tournamentProgressByStage: PublicDashboardSnapshot['tournamentProgressByStage'];
}> {
  const snapshot = await getPublicTournamentSnapshot(db);
  return {
    groupStandings: snapshot.groupStandings,
    topScorers: snapshot.topScorers,
    playoffBracket: snapshot.playoffBracket,
    tournamentSummary: snapshot.tournamentSummary,
    tournamentStats: snapshot.tournamentStats,
    tournamentProgressByStage: snapshot.tournamentProgressByStage
  };
}

export async function refreshDerivedTournamentTables(db: QueryableDatabase, now: Date, topScorers: PublicTopScorer[] = []): Promise<void> {
  await migrateResultPersistenceSchema(db);
  const standings = await calculateGroupStandings(db);
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
        `INSERT INTO top_scorer_standings (id, rank, player_name, team_id, goals, assists, minutes_played, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [`${scorer.rank}-${slug(scorer.player)}`, scorer.rank, scorer.player, teamId ?? null, scorer.goals, scorer.assists, null, now.toISOString()]
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
  `);
}

async function getConfirmedLatestResults(db: QueryableDatabase): Promise<PublicResultCard[]> {
  const rows = await db.all(`
    SELECT
      m.id,
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
    WHERE r.public_status = 'CONFIRMED_FINAL' AND r.is_final = 1
    ORDER BY COALESCE(r.confirmed_at, r.last_checked_at) DESC, m.id DESC
    LIMIT 8
  `);
  return rows.map((row) => {
    const homeScore = Number(row.confirmed_home_score);
    const awayScore = Number(row.confirmed_away_score);
    const homeTeam = String(row.home_team);
    const awayTeam = String(row.away_team);
    return {
      id: String(row.id),
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      stage: row.group_id ? `Alagrupp ${row.group_id}` : 'Turniir',
      winner: homeScore === awayScore ? 'Draw' : homeScore > awayScore ? homeTeam : awayTeam,
      finishedAt: formatDateTime(String(row.confirmed_at ?? row.kickoff_at))
    };
  });
}

async function getUpcomingMatches(db: QueryableDatabase): Promise<PublicMatchCard[]> {
  return (await getPublicMatches(db))
    .filter((match) => match.state === 'upcoming')
    .map(toMatchCard);
}

async function getPublicMatches(db: QueryableDatabase): Promise<Array<{
  id: number;
  groupId?: string;
  kickoffAt: string;
  homeTeam: string;
  awayTeam: string;
  publicStatus: string;
  state: 'live' | 'today' | 'upcoming';
}>> {
  const rows = await db.all(`
    SELECT
      m.id,
      m.group_id,
      m.kickoff_at,
      COALESCE(home.name, m.home_slot) AS home_team,
      COALESCE(away.name, m.away_slot) AS away_team,
      r.public_status,
      r.is_final
    FROM matches m
    LEFT JOIN match_results r ON r.match_id = m.id
    LEFT JOIN teams home ON home.id = m.home_team_id
    LEFT JOIN teams away ON away.id = m.away_team_id
    ORDER BY m.kickoff_at, m.id
  `);
  const now = new Date();
  return rows.flatMap((row) => {
    const kickoffAt = String(row.kickoff_at);
    if (Number.isNaN(Date.parse(kickoffAt))) return [];
    const publicStatus = String(row.public_status ?? 'SCHEDULED');
    const isFinal = Number(row.is_final ?? 0) === 1 && publicStatus === 'CONFIRMED_FINAL';
    if (isFinal) return [];
    const kickoffMs = Date.parse(kickoffAt);
    const state = kickoffMs <= now.getTime() ? 'live' : sameTallinnDate(kickoffAt, now) ? 'today' : 'upcoming';
    return [{
      id: Number(row.id),
      groupId: row.group_id ? String(row.group_id) : undefined,
      kickoffAt,
      homeTeam: String(row.home_team),
      awayTeam: String(row.away_team),
      publicStatus,
      state
    }];
  });
}

function toMatchCard(match: {
  id: number;
  groupId?: string;
  kickoffAt: string;
  homeTeam: string;
  awayTeam: string;
  publicStatus: string;
  state: 'live' | 'today' | 'upcoming';
}): PublicMatchCard {
  return {
    id: String(match.id),
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    kickoffTime: formatDateTime(match.kickoffAt),
    stage: match.groupId ? `Alagrupp ${match.groupId}` : 'Turniir',
    status: match.state === 'live' ? 'live' : publicMatchStatus(match.publicStatus),
    venue: ''
  };
}

async function getPublicGroupStandings(db: QueryableDatabase): Promise<PublicGroupStanding[]> {
  const persisted = await db.all(`
    SELECT gs.*, COALESCE(t.name, gs.team_id) AS team_name
    FROM group_standings gs
    LEFT JOIN teams t ON t.id = gs.team_id
    ORDER BY gs.group_id, gs.rank, gs.team_id
  `);
  if (persisted.length > 0) return groupRowsToPublic(persisted);
  return calculateGroupStandings(db);
}

async function calculateGroupStandings(db: QueryableDatabase): Promise<PublicGroupStanding[]> {
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
    SELECT m.home_team_id, m.away_team_id, r.confirmed_home_score, r.confirmed_away_score
    FROM match_results r
    JOIN matches m ON m.id = r.match_id
    WHERE r.public_status = 'CONFIRMED_FINAL' AND r.is_final = 1 AND m.stage = 'GROUP'
  `);

  for (const result of results) {
    const home = standings.get(String(result.home_team_id));
    const away = standings.get(String(result.away_team_id));
    if (!home || !away) continue;
    applyResult(home, Number(result.confirmed_home_score), Number(result.confirmed_away_score));
    applyResult(away, Number(result.confirmed_away_score), Number(result.confirmed_home_score));
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
  const rows = await db.all(`
    SELECT ts.rank, ts.player_name, ts.goals, COALESCE(ts.assists, 0) AS assists, COALESCE(t.name, ts.team_id) AS team_name
    FROM top_scorer_standings ts
    LEFT JOIN teams t ON t.id = ts.team_id
    ORDER BY ts.rank, ts.player_name
    LIMIT 20
  `);
  return rows.map((row) => ({
    rank: Number(row.rank),
    player: String(row.player_name),
    team: String(row.team_name ?? ''),
    goals: Number(row.goals),
    assists: Number(row.assists ?? 0)
  }));
}

function groupRowsToPublic(rows: Record<string, unknown>[]): PublicGroupStanding[] {
  const groups = [...new Set(rows.map((row) => String(row.group_id)))].sort();
  return groups.map((group) => ({
    group,
    teams: rows.filter((row) => String(row.group_id) === group).map((row) => ({
      rank: Number(row.rank),
      team: String(row.team_name),
      played: Number(row.played),
      wins: Number(row.wins),
      draws: Number(row.draws),
      losses: Number(row.losses),
      goalsFor: Number(row.goals_for),
      goalsAgainst: Number(row.goals_against),
      goalDifference: Number(row.goal_difference),
      points: Number(row.points),
      state: Number(row.played) === 0 ? 'at-risk' : Number(row.rank) <= 2 ? 'qualified' : Number(row.rank) === 3 ? 'third-place' : 'at-risk'
    }))
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
  return `${date} • ${time}`;
}

function formatDecimal(value: number): string {
  return value.toLocaleString('et-EE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function publicMatchStatus(publicStatus: string): PublicMatchCard['status'] {
  if (publicStatus === 'LIVE') return 'live';
  if (publicStatus === 'CONFIRMING' || publicStatus === 'NEEDS_REVIEW') return 'confirming';
  return 'scheduled';
}

function sameTallinnDate(kickoffAt: string, now: Date): boolean {
  const formatter = new Intl.DateTimeFormat('et-EE', {
    timeZone: 'Europe/Tallinn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date(kickoffAt)) === formatter.format(now);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
