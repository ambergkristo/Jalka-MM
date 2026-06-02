import type { GroupBonusPrediction, KnockoutBonusPrediction } from '../../domain/types.js';

export interface BonusDraft {
  groups: GroupBonusPrediction[];
  knockout: KnockoutBonusPrediction & { topScorersText?: string };
}

export function readBonusDraft(row: any, groupIds: string[], includeGroups = false): BonusDraft {
  if (row?.group_json && row?.knockout_json) {
    return { groups: includeGroups ? JSON.parse(String(row.group_json)) : [], knockout: JSON.parse(String(row.knockout_json)) };
  }
  return {
    groups: includeGroups ? groupIds.map((groupId) => ({ groupId, winnerTeamId: '', secondTeamId: '', qualifierTeamIds: [] })) : [],
    knockout: { r16TeamIds: [], qfTeamIds: [], sfTeamIds: [], finalTeamIds: [], thirdPlaceWinnerTeamId: '', championTeamId: '', topScorer: '', topScorersText: '' }
  };
}

export function countMissingBonus(draft: BonusDraft): number {
  return Math.max(0, 16 - draft.knockout.r16TeamIds.length)
    + Math.max(0, 8 - draft.knockout.qfTeamIds.length)
    + Math.max(0, 4 - draft.knockout.sfTeamIds.length)
    + Math.max(0, 2 - draft.knockout.finalTeamIds.length)
    + Number(!draft.knockout.thirdPlaceWinnerTeamId)
    + Number(!draft.knockout.championTeamId)
    + Number(!draft.knockout.topScorer);
}

export function toggleTeam(values: string[], teamId: string, max: number): string[] {
  if (values.includes(teamId)) return values.filter((value) => value !== teamId);
  if (values.length >= max) return values;
  return [...values, teamId];
}

export function splitTopScorers(value: string): string[] {
  return value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
}
