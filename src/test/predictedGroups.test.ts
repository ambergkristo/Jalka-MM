import { describe, expect, it } from 'vitest';
import { derivePredictedGroupOutcomes } from '../domain/predictedGroups.js';
import type { Match, MatchPrediction, Team } from '../domain/types.js';

function teams(): Team[] {
  return Array.from({ length: 12 }, (_, groupIndex) => {
    const groupId = String.fromCharCode(65 + groupIndex);
    return Array.from({ length: 4 }, (_unused, teamIndex) => ({ id: `${groupId}${teamIndex + 1}`, name: `${groupId}${teamIndex + 1}`, code: `${groupId}${teamIndex + 1}`, flag: '', groupId }));
  }).flat();
}

function matches(): Match[] {
  let id = 1;
  return Array.from({ length: 12 }, (_, groupIndex) => {
    const groupId = String.fromCharCode(65 + groupIndex);
    const pairs = [[1, 2], [3, 4], [1, 3], [2, 4], [1, 4], [2, 3]];
    return pairs.map(([home, away]) => ({ id: id++, stage: 'GROUP' as const, groupId, kickoffAt: 'TBC', homeTeamId: `${groupId}${home}`, awayTeamId: `${groupId}${away}`, homeSlot: '', awaySlot: '' }));
  }).flat();
}

function decisivePredictions(matches: Match[]): MatchPrediction[] {
  return matches.map((match) => {
    const homeSeed = Number(match.homeTeamId?.slice(1));
    const awaySeed = Number(match.awayTeamId?.slice(1));
    return { matchId: match.id, homeGoals: homeSeed < awaySeed ? 2 : 0, awayGoals: awaySeed < homeSeed ? 2 : 0 };
  });
}

describe('derived predicted group outcomes', () => {
  it('derives group winner, runner-up and eight best third-place qualifiers from match scores', () => {
    const outcome = derivePredictedGroupOutcomes(teams(), matches(), decisivePredictions(matches()));
    expect(outcome.groups).toHaveLength(12);
    expect(outcome.groupBonuses.find((group) => group.groupId === 'A')?.winnerTeamId).toBe('A1');
    expect(outcome.groupBonuses.find((group) => group.groupId === 'A')?.secondTeamId).toBe('A2');
    expect(outcome.advancingThirdPlaceTeamIds).toHaveLength(8);
  });

  it('requires tie resolution only when a relevant ranking remains tied', () => {
    const allDraws = matches().map((match) => ({ matchId: match.id, homeGoals: 0, awayGoals: 0 }));
    const unresolved = derivePredictedGroupOutcomes(teams(), matches(), allDraws);
    expect(unresolved.unresolvedTies.some((issue) => issue.groupId === 'A')).toBe(true);

    const resolved = derivePredictedGroupOutcomes(teams(), matches(), allDraws, [{ groupId: 'A', teamOrder: ['A1', 'A2', 'A3', 'A4'] }]);
    expect(resolved.groups.find((group) => group.groupId === 'A')?.winnerTeamId).toBe('A1');
  });
});
