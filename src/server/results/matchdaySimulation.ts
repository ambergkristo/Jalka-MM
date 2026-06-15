import { createMatches, createTeams } from '../../domain/seed.js';
import { getTournamentData } from '../../domain/tournamentData.js';
import type { QueryableDatabase, QueryValue } from '../databaseAdapter.js';
import { DatabaseResultRepository } from './databaseResultRepository.js';
import { ProviderChainResultProvider } from './providerChainResultProvider.js';
import { refreshDerivedTournamentTables, resetPublicTournamentRuntimeState, type PublicTopScorer } from './publicTournamentSnapshot.js';
import { runResultUpdateCycle } from './resultAgent.js';
import type { ResultAgentRunSummary } from './resultTypes.js';
import { MATCHDAY1_SIMULATION_RESULTS } from './simulationFixtures.js';
import { SimulationResultProvider } from './simulationResultProvider.js';
import { CONFIRMED_FINAL_RESULT_SQL } from './finalizedResultState.js';

export const MATCHDAY1_PROVISIONAL_AT = new Date('2026-06-12T21:00:00.000Z');
export const MATCHDAY1_CONFIRM_AT = new Date('2026-06-12T21:11:00.000Z');

export interface Matchday1SimulationReport {
  provisionalRun: ResultAgentRunSummary;
  confirmingRun: ResultAgentRunSummary;
  confirmedResultsCount: number;
  leaderboardRows: number;
  latestResultsCount: number;
  topScorersCount: number;
}

export interface Matchday1DisagreementReport {
  disagreementRun: ResultAgentRunSummary;
  needsReviewCount: number;
  leaderboardRows: number;
}

export async function resetSimulationState(db: QueryableDatabase, options: { seedSchedule?: boolean } = {}): Promise<void> {
  if (options.seedSchedule) await seedTournamentStructure(db);
  await resetPublicTournamentRuntimeState(db);
  await refreshDerivedTournamentTables(db, new Date('2026-06-11T00:00:00.000Z'), []);
}

export async function runMatchday1Simulation(db: QueryableDatabase): Promise<Matchday1SimulationReport> {
  await resetSimulationState(db, { seedSchedule: true });
  const repository = new DatabaseResultRepository(db);
  const provider = new SimulationResultProvider('matchday1');

  const provisionalRun = await runResultUpdateCycle({
    repository,
    leaderboardRepository: repository,
    provider,
    now: MATCHDAY1_PROVISIONAL_AT,
    confirmationDelayMinutes: 10
  });

  const confirmingRun = await runResultUpdateCycle({
    repository,
    leaderboardRepository: repository,
    provider,
    now: MATCHDAY1_CONFIRM_AT,
    confirmationDelayMinutes: 10
  });

  await refreshDerivedTournamentTables(db, MATCHDAY1_CONFIRM_AT, simulatedTopScorers());

  return {
    provisionalRun,
    confirmingRun,
    confirmedResultsCount: (await repository.getFinalizedResults()).length,
    leaderboardRows: (await repository.getLeaderboard()).length,
    latestResultsCount: Number((await db.one(`SELECT COUNT(*) AS count FROM match_results WHERE ${CONFIRMED_FINAL_RESULT_SQL}`))?.count ?? 0),
    topScorersCount: Number((await db.one('SELECT COUNT(*) AS count FROM top_scorer_standings'))?.count ?? 0)
  };
}

export async function runMatchday1DisagreementSimulation(db: QueryableDatabase): Promise<Matchday1DisagreementReport> {
  await resetSimulationState(db, { seedSchedule: true });
  const repository = new DatabaseResultRepository(db);
  const provider = new ProviderChainResultProvider([
    new SimulationResultProvider('matchday1', 'simulation-provider-a'),
    new SimulationResultProvider('matchday1-disagreement', 'simulation-provider-b')
  ]);

  const disagreementRun = await runResultUpdateCycle({
    repository,
    leaderboardRepository: repository,
    provider,
    now: MATCHDAY1_PROVISIONAL_AT,
    confirmationDelayMinutes: 10
  });

  return {
    disagreementRun,
    needsReviewCount: Number((await db.one("SELECT COUNT(*) AS count FROM match_results WHERE public_status = 'NEEDS_REVIEW'"))?.count ?? 0),
    leaderboardRows: (await repository.getLeaderboard()).length
  };
}

export function simulatedTopScorers(): PublicTopScorer[] {
  const byPlayer = new Map<string, { player: string; teamId: string; goals: number }>();
  for (const goal of MATCHDAY1_SIMULATION_RESULTS.flatMap((result) => result.goals)) {
    const row = byPlayer.get(goal.playerName) ?? { player: goal.playerName, teamId: goal.teamId, goals: 0 };
    row.goals += goal.goals;
    byPlayer.set(goal.playerName, row);
  }
  return [...byPlayer.values()]
    .sort((a, b) => b.goals - a.goals || a.player.localeCompare(b.player))
    .map((row, index) => ({ rank: index + 1, player: row.player, team: row.teamId, goals: row.goals, assists: 0 }));
}

async function seedTournamentStructure(db: QueryableDatabase): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, name TEXT NOT NULL, name_et TEXT, code TEXT, flag TEXT, group_id TEXT);
    CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS matches (id INTEGER PRIMARY KEY, stage TEXT NOT NULL, group_id TEXT, kickoff_at TEXT NOT NULL, home_team_id TEXT, away_team_id TEXT, home_slot TEXT NOT NULL, away_slot TEXT NOT NULL);
    DELETE FROM matches;
    DELETE FROM groups;
    DELETE FROM teams;
  `);
  for (const group of getTournamentData().groups) await upsert(db, 'groups', ['id', 'name'], [group.id, group.name], ['id']);
  for (const team of createTeams()) await upsert(db, 'teams', ['id', 'name', 'name_et', 'code', 'flag', 'group_id'], [team.id, team.name, team.nameEt ?? team.name, team.code, team.flag, team.groupId ?? null], ['id']);
  for (const match of createMatches()) await upsert(db, 'matches', ['id', 'stage', 'group_id', 'kickoff_at', 'home_team_id', 'away_team_id', 'home_slot', 'away_slot'], [match.id, match.stage, match.groupId ?? null, match.kickoffAt, match.homeTeamId ?? null, match.awayTeamId ?? null, match.homeSlot, match.awaySlot], ['id']);
}

async function upsert(db: QueryableDatabase, table: string, columns: string[], values: QueryValue[], conflictColumns: string[]): Promise<void> {
  if (db.provider === 'postgres') {
    const updateColumns = columns.filter((column) => !conflictColumns.includes(column));
    await db.run(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})
      ON CONFLICT (${conflictColumns.join(', ')}) DO UPDATE SET ${updateColumns.map((column) => `${column} = EXCLUDED.${column}`).join(', ')}`, values);
  } else {
    await db.run(`INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, values);
  }
}
