import type { QueryableDatabase } from '../databaseAdapter.js';
import { isConfirmedFinalResult } from './finalizedResultState.js';
import { MANUAL_UNKNOWN_SCORER_NAME } from './manualScorerCorrections.js';
import { resolveScorerIdentity } from '../../domain/scorerIdentity.js';
import type { ActualGroupStanding, ActualKnockoutResults, ActualTopScorer } from '../../domain/pointsEngine.js';

export interface ActualScoringState {
  actualGroupStandings?: ActualGroupStanding[];
  actualKnockoutResults?: ActualKnockoutResults;
  actualTopScorers?: ActualTopScorer[];
}

export async function buildActualScoringState(db: QueryableDatabase): Promise<ActualScoringState> {
  const [actualGroupStandings, actualKnockoutResults, actualTopScorers] = await Promise.all([
    buildActualGroupStandings(db),
    buildActualKnockoutResults(db),
    buildActualTopScorers(db)
  ]);
  return {
    actualGroupStandings,
    actualKnockoutResults,
    actualTopScorers
  };
}

export async function buildActualGroupStandings(db: QueryableDatabase): Promise<ActualGroupStanding[]> {
  const teams = await db.all(`
    SELECT id, name, name_et, group_id
    FROM teams
    WHERE group_id IS NOT NULL
    ORDER BY group_id, id
  `);
  const standings = new Map<string, {
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
  }>();
  for (const team of teams) {
    const groupId = String(team.group_id);
    const teamId = String(team.id);
    standings.set(teamId, {
      groupId,
      teamId,
      teamName: teamDisplayName(team),
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0
    });
  }

  const groupCoverage = new Map<string, { total: number; confirmed: number }>();
  const results = await db.all(`
    SELECT
      m.group_id,
      m.home_team_id,
      m.away_team_id,
      r.*
    FROM matches m
    LEFT JOIN match_results r ON r.match_id = m.id
    WHERE m.stage = 'GROUP' AND m.group_id IS NOT NULL
    ORDER BY m.id
  `);

  for (const result of results) {
    const groupId = String(result.group_id);
    const coverage = groupCoverage.get(groupId) ?? { total: 0, confirmed: 0 };
    coverage.total += 1;
    if (isConfirmedFinalResult(result)) coverage.confirmed += 1;
    groupCoverage.set(groupId, coverage);

    if (!isConfirmedFinalResult(result)) continue;
    const home = standings.get(String(result.home_team_id));
    const away = standings.get(String(result.away_team_id));
    if (!home || !away) continue;
    const homeScore = Number(result.confirmed_home_score ?? result.home_score ?? 0);
    const awayScore = Number(result.confirmed_away_score ?? result.away_score ?? 0);
    applyResult(home, homeScore, awayScore);
    applyResult(away, awayScore, homeScore);
  }

  const finalGroups = [...groupCoverage.entries()]
    .filter(([, coverage]) => coverage.total > 0 && coverage.confirmed === coverage.total)
    .map(([groupId]) => groupId)
    .sort();

  const finalStandingsByGroup = new Map(
    finalGroups.map((groupId) => [
      groupId,
      [...standings.values()]
        .filter((row) => row.groupId === groupId)
        .sort((a, b) =>
          b.points - a.points ||
          goalDifference(b) - goalDifference(a) ||
          b.goalsFor - a.goalsFor ||
          a.teamName.localeCompare(b.teamName, 'et')
        )
    ])
  );

  const advancingThirdPlaceTeamIds = finalGroups.length === 12
    ? new Set(
      [...finalStandingsByGroup.entries()]
        .flatMap(([groupId, groupRows]) => {
          const thirdPlace = groupRows[2];
          return thirdPlace ? [{ ...thirdPlace, groupId }] : [];
        })
        .sort((a, b) =>
          b.points - a.points ||
          goalDifference(b) - goalDifference(a) ||
          b.goalsFor - a.goalsFor ||
          a.groupId.localeCompare(b.groupId, 'et') ||
          a.teamName.localeCompare(b.teamName, 'et')
        )
        .slice(0, 8)
        .map((row) => row.teamId)
    )
    : new Set<string>();

  const rows: ActualGroupStanding[] = [];
  for (const groupId of finalGroups) {
    const sorted = finalStandingsByGroup.get(groupId) ?? [];
    for (const [index, row] of sorted.entries()) {
      rows.push({
        group: groupId,
        team: row.teamName,
        rank: index + 1,
        qualified: index < 2 || advancingThirdPlaceTeamIds.has(row.teamId)
      });
    }
  }

  return rows;
}

export async function buildActualKnockoutResults(db: QueryableDatabase): Promise<ActualKnockoutResults> {
  const stageCoverage = await getKnockoutStageCoverage(db);
  const actualKnockoutResults: ActualKnockoutResults = { stageTeams: {} };
  const stageOrder: Array<'R32' | 'R16' | 'QF' | 'SF'> = ['R32', 'R16', 'QF', 'SF'];
  const stageToNextRound: Record<'R32' | 'R16' | 'QF' | 'SF', 'R16' | 'QF' | 'SF' | 'Final'> = {
    R32: 'R16',
    R16: 'QF',
    QF: 'SF',
    SF: 'Final'
  };

  for (const stage of stageOrder) {
    const coverage = stageCoverage.get(stage);
    if (!coverage || coverage.total === 0 || coverage.confirmed !== coverage.total) continue;
    const winners = await getConfirmedStageWinners(db, stage);
    if (winners.length === 0) continue;
    actualKnockoutResults.stageTeams![stageToNextRound[stage]] = winners;
  }

  const thirdPlaceWinner = await getSingleKnockoutWinner(db, 'THIRD_PLACE');
  if (thirdPlaceWinner) actualKnockoutResults.thirdPlaceWinner = thirdPlaceWinner;

  const champion = await getSingleKnockoutWinner(db, 'FINAL');
  if (champion) actualKnockoutResults.champion = champion;

  if (!actualKnockoutResults.stageTeams || Object.keys(actualKnockoutResults.stageTeams).length === 0) delete actualKnockoutResults.stageTeams;
  return actualKnockoutResults;
}

export async function buildActualTopScorers(db: QueryableDatabase): Promise<ActualTopScorer[]> {
  const rows = await db.all(`
    SELECT
      facts.player_id,
      facts.provider_player_id,
      facts.player_name,
      facts.team_id,
      facts.team_code,
      COALESCE(team.name_et, team.name, facts.team_code, facts.team_id, '') AS team_name,
      SUM(COALESCE(facts.goals, 0)) AS goals
    FROM result_manual_scorers facts
    LEFT JOIN teams team ON team.id = facts.team_id OR team.code = facts.team_code
    WHERE facts.player_name <> ?
    GROUP BY facts.player_id, facts.provider_player_id, facts.player_name, facts.team_id, facts.team_code, COALESCE(team.name_et, team.name, facts.team_code, facts.team_id, '')
    HAVING SUM(COALESCE(facts.goals, 0)) > 0
    ORDER BY goals DESC, facts.player_name ASC
  `, [MANUAL_UNKNOWN_SCORER_NAME]);
  if (rows.length === 0) return [];

  const aggregated = rows.map((row) => ({
    identity: resolveScorerIdentity({
      playerName: String(row.player_name ?? ''),
      playerId: stringOrUndefined(row.player_id),
      providerPlayerId: stringOrUndefined(row.provider_player_id)
    }),
    goals: Number(row.goals ?? 0),
    team: stringOrUndefined(row.team_name) ?? resolveTeamNameFromFacts({
      teamId: stringOrUndefined(row.team_id),
      teamCode: stringOrUndefined(row.team_code),
      teamName: undefined
    })
  }));
  const maxGoals = Math.max(...aggregated.map((row) => row.goals));
  return aggregated
    .filter((row) => row.goals === maxGoals)
    .map((row) => ({
      name: row.identity.playerName,
      team: row.team
    }));
}

async function getKnockoutStageCoverage(db: QueryableDatabase): Promise<Map<'R32' | 'R16' | 'QF' | 'SF' | 'THIRD_PLACE' | 'FINAL', { total: number; confirmed: number }>> {
  const rows = await db.all(`
    SELECT
      m.stage,
      m.id,
      r.*
    FROM matches m
    LEFT JOIN match_results r ON r.match_id = m.id
    WHERE m.stage IN ('R32', 'R16', 'QF', 'SF', 'THIRD_PLACE', 'FINAL')
    ORDER BY m.stage, m.id
  `);
  const coverage = new Map<'R32' | 'R16' | 'QF' | 'SF' | 'THIRD_PLACE' | 'FINAL', { total: number; confirmed: number }>();
  for (const row of rows) {
    const stage = row.stage as 'R32' | 'R16' | 'QF' | 'SF' | 'THIRD_PLACE' | 'FINAL';
    const entry = coverage.get(stage) ?? { total: 0, confirmed: 0 };
    entry.total += 1;
    if (isConfirmedFinalResult(row)) entry.confirmed += 1;
    coverage.set(stage, entry);
  }
  return coverage;
}

async function getConfirmedStageWinners(db: QueryableDatabase, stage: 'R32' | 'R16' | 'QF' | 'SF'): Promise<string[]> {
  const rows = await db.all(`
    SELECT
      m.id,
      m.home_team_id,
      m.away_team_id,
      home.code AS home_team_code,
      away.code AS away_team_code,
      COALESCE(home.name_et, home.name, m.home_slot) AS home_team,
      COALESCE(away.name_et, away.name, m.away_slot) AS away_team,
      r.*,
      COALESCE(c.penalty_winner_team_id, c.penalty_winner_team_code) AS penalty_winner
    FROM match_results r
    JOIN matches m ON m.id = r.match_id
    LEFT JOIN teams home ON home.id = m.home_team_id
    LEFT JOIN teams away ON away.id = m.away_team_id
    LEFT JOIN (
      SELECT c1.*
      FROM result_manual_corrections c1
      JOIN (
        SELECT match_id, MAX(created_at) AS created_at
        FROM result_manual_corrections
        GROUP BY match_id
      ) latest
        ON latest.match_id = c1.match_id AND latest.created_at = c1.created_at
    ) c ON c.match_id = m.id
    WHERE m.stage = ?
    ORDER BY m.id
  `, [stage]);

  return rows.flatMap((row) => {
    if (!isConfirmedFinalResult(row)) return [];
    const winner = resolveWinner(row);
    return winner ? [winner] : [];
  });
}

async function getSingleKnockoutWinner(db: QueryableDatabase, stage: 'THIRD_PLACE' | 'FINAL'): Promise<string | undefined> {
  const rows = await db.all(`
    SELECT
      m.id,
      m.home_team_id,
      m.away_team_id,
      home.code AS home_team_code,
      away.code AS away_team_code,
      COALESCE(home.name_et, home.name, m.home_slot) AS home_team,
      COALESCE(away.name_et, away.name, m.away_slot) AS away_team,
      r.*,
      COALESCE(c.penalty_winner_team_id, c.penalty_winner_team_code) AS penalty_winner
    FROM match_results r
    JOIN matches m ON m.id = r.match_id
    LEFT JOIN teams home ON home.id = m.home_team_id
    LEFT JOIN teams away ON away.id = m.away_team_id
    LEFT JOIN (
      SELECT c1.*
      FROM result_manual_corrections c1
      JOIN (
        SELECT match_id, MAX(created_at) AS created_at
        FROM result_manual_corrections
        GROUP BY match_id
      ) latest
        ON latest.match_id = c1.match_id AND latest.created_at = c1.created_at
    ) c ON c.match_id = m.id
    WHERE m.stage = ?
    ORDER BY m.id
    LIMIT 1
  `, [stage]);
  if (!isConfirmedFinalResult(rows[0] ?? {})) return undefined;
  return resolveWinner(rows[0]);
}

function resolveWinner(row: Record<string, unknown> | undefined): string | undefined {
  if (!row) return undefined;
  const homeScore = Number(row.home_score ?? 0);
  const awayScore = Number(row.away_score ?? 0);
  if (homeScore > awayScore) return String(row.home_team ?? '');
  if (awayScore > homeScore) return String(row.away_team ?? '');
  const penaltyWinner = stringOrUndefined(row.penalty_winner);
  if (!penaltyWinner) return undefined;
  return resolvePenaltyWinnerName(penaltyWinner, row);
}

function resolvePenaltyWinnerName(penaltyWinner: string, row: Record<string, unknown>): string | undefined {
  const homeTeamId = stringOrUndefined(row.home_team_id);
  const awayTeamId = stringOrUndefined(row.away_team_id);
  const homeTeamCode = stringOrUndefined(row.home_team_code);
  const awayTeamCode = stringOrUndefined(row.away_team_code);
  const homeTeam = stringOrUndefined(row.home_team);
  const awayTeam = stringOrUndefined(row.away_team);
  const winnerKey = penaltyWinner.trim().toUpperCase();
  if ([homeTeamId, homeTeamCode, homeTeam?.toUpperCase()].includes(winnerKey)) return homeTeam;
  if ([awayTeamId, awayTeamCode, awayTeam?.toUpperCase()].includes(winnerKey)) return awayTeam;
  return penaltyWinner;
}

function resolveTeamNameFromFacts(input: { teamId?: string; teamCode?: string; teamName?: string }): string {
  return input.teamName?.trim() || input.teamCode?.trim() || input.teamId?.trim() || '';
}

function teamDisplayName(team: Record<string, unknown>): string {
  return String(team.name_et ?? team.name ?? '');
}

function applyResult(row: {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}, goalsFor: number, goalsAgainst: number): void {
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

function goalDifference(row: { goalsFor: number; goalsAgainst: number }): number {
  return row.goalsFor - row.goalsAgainst;
}

function stringOrUndefined(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return String(value);
}
