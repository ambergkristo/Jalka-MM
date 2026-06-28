import matchesJson from '../data/worldcup2026/matches.json' with { type: 'json' };
import teamsJson from '../data/worldcup2026/teams.json' with { type: 'json' };
import referenceJson from './fixtures/argo-alagrupi-eri-reference.json' with { type: 'json' };
import resultsJson from './fixtures/final-group-stage-results.json' with { type: 'json' };
import { describe, expect, it } from 'vitest';
import { rebuildLeaderboard, type ActualGroupStanding, type MatchResultForScoring } from '../domain/pointsEngine.js';
import { predictionRepository } from '../domain/predictionRepository.js';
import type { Match, Team } from '../domain/types.js';

interface ScoresheetReferencePlayer {
  playerId: string;
  playerName: string;
  officialRank: number;
  total: number;
  matchPoints: number[];
  groupBonusPoints: Record<string, number>;
}

const matches = matchesJson as Match[];
const teams = teamsJson as Team[];
const referencePlayers = (referenceJson as { players: ScoresheetReferencePlayer[] }).players;
const finalizedResults = (resultsJson as {
  matchIdsInScoresheetOrder: number[];
  results: Array<{ matchId: number; homeScore: number; awayScore: number }>;
}).results;
const scoresheetMatchOrder = (resultsJson as {
  matchIdsInScoresheetOrder: number[];
  results: Array<{ matchId: number; homeScore: number; awayScore: number }>;
}).matchIdsInScoresheetOrder;

describe('final group-stage golden reference', () => {
  it('matches the official ALAGRUPI ERI scoresheet for all 109 players column-by-column', () => {
    const results: MatchResultForScoring[] = finalizedResults.map((result) => ({
      matchId: result.matchId,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      isFinal: true
    }));
    const actualGroupStandings = buildFinalGroupStandings(results);
    const rebuilt = rebuildLeaderboard({
      players: predictionRepository.getPlayers(),
      predictions: predictionRepository.getMatchPredictions(),
      results,
      groupPredictions: predictionRepository.getGroupPredictions(),
      actualGroupStandings,
      recalculatedAt: '2026-06-28T00:00:00.000Z'
    });
    const resultsByPlayerId = new Map(rebuilt.playerResults.map((result) => [result.playerId, result]));

    expect(referencePlayers).toHaveLength(109);
    expect(rebuilt.entries).toHaveLength(109);

    for (const official of referencePlayers) {
      const actual = resultsByPlayerId.get(official.playerId);
      expect(actual, `Missing rebuilt player ${official.playerId}`).toBeDefined();
      if (!actual) continue;

      expect(actual.totalPoints).toBe(official.total);
      expect(matchPointsInScoresheetOrder(actual.breakdown)).toEqual(official.matchPoints);
      expect(groupBreakdownByGroup(actual.groupBreakdown)).toEqual(official.groupBonusPoints);
      expect(actual.playoffBonusPoints).toBe(0);
      expect(actual.topScorerBonusPoints).toBe(0);
    }
  });
});

function buildFinalGroupStandings(results: MatchResultForScoring[]): ActualGroupStanding[] {
  const rowsByGroup = new Map<string, Array<{
    teamId: string;
    group: string;
    team: string;
    points: number;
    goalsFor: number;
    goalsAgainst: number;
  }>>();

  for (const team of teams) {
    if (!team.groupId) continue;
    rowsByGroup.set(team.groupId, [
      ...(rowsByGroup.get(team.groupId) ?? []),
      {
        teamId: team.id,
        group: team.groupId,
        team: team.nameEt ?? team.name,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0
      }
    ]);
  }

  const resultByMatchId = new Map(results.map((result) => [result.matchId, result]));
  for (const match of matches.filter((row) => row.stage === 'GROUP')) {
    const result = resultByMatchId.get(match.id);
    if (!result || !match.groupId || !match.homeTeamId || !match.awayTeamId) continue;
    const groupRows = rowsByGroup.get(match.groupId);
    const home = groupRows?.find((row) => row.teamId === match.homeTeamId);
    const away = groupRows?.find((row) => row.teamId === match.awayTeamId);
    if (!home || !away) continue;

    applyGroupResult(home, result.homeScore, result.awayScore);
    applyGroupResult(away, result.awayScore, result.homeScore);
  }

  const sortedGroups = [...rowsByGroup.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'et'))
    .map(([group, groupRows]) => ({
      group,
      rows: [...groupRows].sort((left, right) =>
        right.points - left.points ||
        goalDifference(right) - goalDifference(left) ||
        right.goalsFor - left.goalsFor ||
        left.team.localeCompare(right.team, 'et')
      )
    }));

  const bestThirds = sortedGroups
    .map(({ group, rows }) => ({ group, ...rows[2] }))
    .sort((left, right) =>
      right.points - left.points ||
      goalDifference(right) - goalDifference(left) ||
      right.goalsFor - left.goalsFor ||
      left.group.localeCompare(right.group, 'et') ||
      left.team.localeCompare(right.team, 'et')
    )
    .slice(0, 8);
  const qualifiedThirdPlaceTeamIds = new Set(bestThirds.map((row) => row.teamId));

  return sortedGroups.flatMap(({ group, rows }) =>
    rows.map((row, index) => ({
      group,
      team: row.team,
      rank: index + 1,
      qualified: index < 2 || qualifiedThirdPlaceTeamIds.has(row.teamId),
      qualifierSource: index < 2 ? 'groupTop2' : qualifiedThirdPlaceTeamIds.has(row.teamId) ? 'mathematicalLock' : 'notConfirmed'
    }))
  );
}

function applyGroupResult(
  row: { points: number; goalsFor: number; goalsAgainst: number },
  goalsFor: number,
  goalsAgainst: number
): void {
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  if (goalsFor > goalsAgainst) {
    row.points += 3;
  } else if (goalsFor === goalsAgainst) {
    row.points += 1;
  }
}

function goalDifference(row: { goalsFor: number; goalsAgainst: number }): number {
  return row.goalsFor - row.goalsAgainst;
}

function groupBreakdownByGroup(rows: Array<{ group: string; points: number }>): Record<string, number> {
  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  return groups.reduce<Record<string, number>>((accumulator, group) => {
    accumulator[group] = rows.find((row) => row.group === group)?.points ?? 0;
    return accumulator;
  }, {});
}

function matchPointsInScoresheetOrder(rows: Array<{ matchId: number; points: number }>): number[] {
  const pointsByMatchId = new Map(rows.map((row) => [row.matchId, row.points]));
  return scoresheetMatchOrder.map((matchId) => pointsByMatchId.get(matchId) ?? 0);
}
