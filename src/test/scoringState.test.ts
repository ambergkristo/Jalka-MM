import { describe, expect, it } from 'vitest';
import { buildActualKnockoutResults, buildActualScoringState, buildActualTopScorers } from '../server/results/scoringState.js';

describe('actual scoring state derivation', () => {
  it('derives confirmed knockout progression and tied top scorers', async () => {
    const db = createMockDatabase({
      teams: baseTeams(),
      matches: baseMatches(),
      results: [
        { matchId: 1, homeScore: 2, awayScore: 1, publicStatus: 'CONFIRMED_FINAL', isFinal: true },
        { matchId: 2, homeScore: 0, awayScore: 2, publicStatus: 'CONFIRMED_FINAL', isFinal: true },
        { matchId: 3, homeScore: 1, awayScore: 0, publicStatus: 'CONFIRMED_FINAL', isFinal: true },
        { matchId: 4, homeScore: 2, awayScore: 0, publicStatus: 'CONFIRMED_FINAL', isFinal: true },
        { matchId: 5, homeScore: 3, awayScore: 1, publicStatus: 'CONFIRMED_FINAL', isFinal: true },
        { matchId: 6, homeScore: 2, awayScore: 1, publicStatus: 'CONFIRMED_FINAL', isFinal: true },
        { matchId: 7, homeScore: 1, awayScore: 0, publicStatus: 'CONFIRMED_FINAL', isFinal: true },
        { matchId: 8, homeScore: 2, awayScore: 0, publicStatus: 'CONFIRMED_FINAL', isFinal: true }
      ],
      scorerFacts: [
        { id: 's1', matchId: 1, playerName: 'Lionel Messi', teamCode: 'ARG', goals: 2 },
        { id: 's2', matchId: 2, playerName: 'Kylian Mbappe', teamCode: 'FRA', goals: 2 },
        { id: 's3', matchId: 2, playerName: 'manual_unknown_scorer', teamCode: 'FRA', goals: 2 }
      ]
    });

    await expect(buildActualKnockoutResults(db)).resolves.toMatchObject({
      thirdPlaceWinner: 'Third Place Winner',
      champion: 'Champion Winner'
    });
    await expect(buildActualTopScorers(db)).resolves.toEqual([
      { name: 'Kylian Mbapp\u00e9', team: 'France' },
      { name: 'Lionel Messi', team: 'Argentina' }
    ]);
    await expect(buildActualScoringState(db)).resolves.toMatchObject({
      actualKnockoutResults: expect.objectContaining({
        champion: 'Champion Winner'
      }),
      actualTopScorers: [
        { name: 'Kylian Mbapp\u00e9', team: 'France' },
        { name: 'Lionel Messi', team: 'Argentina' }
      ]
    });
  });
});

function createMockDatabase(input: {
  teams: Array<{ id: string; name: string; name_et: string; code: string; group_id?: string | null }>;
  matches: Array<{
    id: number;
    stage: string;
    group_id?: string | null;
    home_team_id?: string | null;
    away_team_id?: string | null;
  }>;
  results: Array<{
    matchId: number;
    homeScore: number;
    awayScore: number;
    publicStatus?: string;
    isFinal?: boolean;
  }>;
  scorerFacts: Array<{
    id: string;
    matchId: number;
    playerName: string;
    teamCode?: string;
    teamId?: string;
    goals: number;
  }>;
}) {
  const resultByMatch = new Map(input.results.map((result) => [result.matchId, result]));
  return {
    provider: 'sqlite',
    async all(sql: string, values: unknown[] = []) {
      if (sql.includes('SELECT id, name, name_et, group_id FROM teams')) {
        return input.teams
          .filter((team) => team.group_id !== undefined && team.group_id !== null)
          .map((team) => ({ id: team.id, name: team.name, name_et: team.name_et, group_id: team.group_id }));
      }

      if (sql.includes('COUNT(*) AS total_matches') && sql.includes("m.stage = 'GROUP'")) {
        const counts = new Map<string, { total: number; confirmed: number }>();
        for (const match of input.matches.filter((match) => match.stage === 'GROUP' && match.group_id)) {
          const current = counts.get(match.group_id!) ?? { total: 0, confirmed: 0 };
          current.total += 1;
          if (resultByMatch.get(match.id)) current.confirmed += 1;
          counts.set(match.group_id!, current);
        }
        return [...counts.entries()].map(([group_id, count]) => ({
          group_id,
          total_matches: count.total,
          confirmed_matches: count.confirmed
        }));
      }

      if (sql.includes('FROM match_results r') && sql.includes("AND m.stage = 'GROUP'")) {
        return input.matches
          .filter((match) => match.stage === 'GROUP')
          .flatMap((match) => {
            const result = resultByMatch.get(match.id);
            if (!result || result.publicStatus !== 'CONFIRMED_FINAL' || !result.isFinal) return [];
            return [{
              group_id: match.group_id,
              home_team_id: match.home_team_id,
              away_team_id: match.away_team_id,
              confirmed_home_score: result.homeScore,
              confirmed_away_score: result.awayScore
            }];
          });
      }

      if (sql.includes("FROM matches m LEFT JOIN match_results r ON r.match_id = m.id") && sql.includes('GROUP BY m.stage')) {
        const coverage = new Map<string, { total: number; confirmed: number }>();
        for (const match of input.matches.filter((match) => ['R32', 'R16', 'QF', 'SF', 'THIRD_PLACE', 'FINAL'].includes(match.stage))) {
          const current = coverage.get(match.stage) ?? { total: 0, confirmed: 0 };
          current.total += 1;
          const result = resultByMatch.get(match.id);
          if (result && result.publicStatus === 'CONFIRMED_FINAL' && result.isFinal) current.confirmed += 1;
          coverage.set(match.stage, current);
        }
        return [...coverage.entries()].map(([stage, count]) => ({
          stage,
          total_matches: count.total,
          confirmed_matches: count.confirmed
        }));
      }

      if (sql.includes("AND m.stage = ?")) {
        const stage = String(values[0]);
        return input.matches
          .filter((match) => match.stage === stage)
          .flatMap((match) => {
            const result = resultByMatch.get(match.id);
            if (!result || result.publicStatus !== 'CONFIRMED_FINAL' || !result.isFinal) return [];
            return [rowForKnockoutMatch(match, result, input.teams)];
          });
      }

      if (sql.includes('FROM result_manual_scorers facts')) {
        const grouped = new Map<string, { playerName: string; teamId?: string; teamCode?: string; goals: number }>();
        for (const fact of input.scorerFacts) {
          if (fact.playerName === 'manual_unknown_scorer') continue;
          const key = `${fact.playerName}|${fact.teamId ?? ''}|${fact.teamCode ?? ''}`;
          const current = grouped.get(key) ?? { playerName: fact.playerName, teamId: fact.teamId, teamCode: fact.teamCode, goals: 0 };
          current.goals += fact.goals;
          grouped.set(key, current);
        }
        return [...grouped.values()]
          .map((row) => ({
            player_name: row.playerName,
            team_id: row.teamId,
            team_code: row.teamCode,
            team_name: teamNameFromTeam(row.teamId, row.teamCode, input.teams),
            goals: row.goals
          }))
          .sort((a, b) => Number(b.goals) - Number(a.goals) || String(a.player_name).localeCompare(String(b.player_name), 'et'));
      }

      return [];
    },
    async one(sql: string, values: unknown[] = []) {
      const rows = await this.all(sql, values);
      return rows[0] ?? null;
    },
    async run() {},
    async exec() {},
    async transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
      return callback(this);
    },
    async close() {}
  };
}

function rowForKnockoutMatch(
  match: { id: number; home_team_id?: string | null; away_team_id?: string | null },
  result: { homeScore: number; awayScore: number },
  teams: Array<{ id: string; name: string; name_et: string; code: string; group_id?: string | null }>
) {
  return {
    id: match.id,
    home_team_id: match.home_team_id,
    away_team_id: match.away_team_id,
    home_team_code: teamCodeFromId(match.home_team_id, teams),
    away_team_code: teamCodeFromId(match.away_team_id, teams),
    home_team: teamNameFromId(match.home_team_id, teams),
    away_team: teamNameFromId(match.away_team_id, teams),
    home_score: result.homeScore,
    away_score: result.awayScore,
    penalty_winner: undefined
  };
}

function teamNameFromId(id: string | null | undefined, teams: Array<{ id: string; name: string; name_et: string; code: string }>): string | undefined {
  return teams.find((team) => team.id === id)?.name_et ?? teams.find((team) => team.id === id)?.name;
}

function teamCodeFromId(id: string | null | undefined, teams: Array<{ id: string; name: string; name_et: string; code: string }>): string | undefined {
  return teams.find((team) => team.id === id)?.code;
}

function teamNameFromTeam(teamId: string | undefined, teamCode: string | undefined, teams: Array<{ id: string; name: string; name_et: string; code: string }>): string {
  const team = teams.find((candidate) => candidate.id === teamId || candidate.code === teamCode);
  return team?.name_et ?? team?.name ?? teamCode ?? teamId ?? '';
}

function baseTeams() {
  return [
    { id: 'A1', name: 'Mexico', name_et: 'Mehhiko', code: 'MEX', group_id: 'A' },
    { id: 'A2', name: 'South Africa', name_et: 'Lõuna-Aafrika', code: 'RSA', group_id: 'A' },
    { id: 'A3', name: 'Korea Republic', name_et: 'Lõuna-Korea', code: 'KOR', group_id: 'A' },
    { id: 'A4', name: 'Czechia', name_et: 'Tšehhi', code: 'CZE', group_id: 'A' },
    { id: 'R32H', name: 'R32 Winner', name_et: 'R32 Winner', code: 'R32H' },
    { id: 'R32A', name: 'R32 Runner-up', name_et: 'R32 Runner-up', code: 'R32A' },
    { id: 'R16H', name: 'R16 Winner', name_et: 'R16 Winner', code: 'R16H' },
    { id: 'R16A', name: 'R16 Runner-up', name_et: 'R16 Runner-up', code: 'R16A' },
    { id: 'QFH', name: 'QF Winner', name_et: 'QF Winner', code: 'QFH' },
    { id: 'QFA', name: 'QF Runner-up', name_et: 'QF Runner-up', code: 'QFA' },
    { id: 'SFH', name: 'SF Winner', name_et: 'SF Winner', code: 'SFH' },
    { id: 'SFA', name: 'SF Runner-up', name_et: 'SF Runner-up', code: 'SFA' },
    { id: 'FINALH', name: 'Champion Winner', name_et: 'Champion Winner', code: 'FINALH' },
    { id: 'FINALA', name: 'Champion Runner-up', name_et: 'Champion Runner-up', code: 'FINALA' },
    { id: 'THIRDH', name: 'Third Place Winner', name_et: 'Third Place Winner', code: 'THIRDH' },
    { id: 'THIRDA', name: 'Third Place Runner-up', name_et: 'Third Place Runner-up', code: 'THIRDA' },
    { id: 'ARG', name: 'Argentina', name_et: 'Argentina', code: 'ARG' },
    { id: 'FRA', name: 'France', name_et: 'France', code: 'FRA' }
  ];
}

function baseMatches() {
  return [
    { id: 1, stage: 'GROUP', group_id: 'A', home_team_id: 'A1', away_team_id: 'A2' },
    { id: 2, stage: 'GROUP', group_id: 'A', home_team_id: 'A3', away_team_id: 'A4' },
    { id: 3, stage: 'R32', home_team_id: 'R32H', away_team_id: 'R32A' },
    { id: 4, stage: 'R16', home_team_id: 'R16H', away_team_id: 'R16A' },
    { id: 5, stage: 'QF', home_team_id: 'QFH', away_team_id: 'QFA' },
    { id: 6, stage: 'SF', home_team_id: 'SFH', away_team_id: 'SFA' },
    { id: 7, stage: 'THIRD_PLACE', home_team_id: 'THIRDH', away_team_id: 'THIRDA' },
    { id: 8, stage: 'FINAL', home_team_id: 'FINALH', away_team_id: 'FINALA' }
  ];
}
