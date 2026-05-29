export type BracketSlot =
  | { type: 'team'; teamId: string; label?: string }
  | { type: 'group-winner'; groupId: string }
  | { type: 'group-runner-up'; groupId: string }
  | { type: 'best-third-place'; selector?: string }
  | { type: 'previous-match-winner'; matchId: number }
  | { type: 'previous-match-loser'; matchId: number }
  | { type: 'unresolved'; label: string };

export interface ResolvedSlot {
  teamId?: string;
  label: string;
  unresolved: boolean;
}

export interface GroupStandingRef {
  teamId: string;
  rank: number;
}

export function formatBracketSlot(slot: BracketSlot): string {
  switch (slot.type) {
    case 'team': return slot.label ?? slot.teamId;
    case 'group-winner': return `Winner Group ${slot.groupId}`;
    case 'group-runner-up': return `Runner-up Group ${slot.groupId}`;
    case 'best-third-place': return slot.selector ? `Best 3rd-place team ${slot.selector}` : 'Best 3rd-place team';
    case 'previous-match-winner': return `Winner Match ${slot.matchId}`;
    case 'previous-match-loser': return `Loser Match ${slot.matchId}`;
    case 'unresolved': return slot.label;
  }
}

export function resolveBracketSlot(slot: BracketSlot, context: { groupStandings?: Record<string, GroupStandingRef[]>; matchWinners?: Record<number, string>; matchLosers?: Record<number, string> } = {}): ResolvedSlot {
  if (slot.type === 'team') return { teamId: slot.teamId, label: formatBracketSlot(slot), unresolved: false };
  if (slot.type === 'group-winner') return resolveGroupRank(slot, 1, context.groupStandings);
  if (slot.type === 'group-runner-up') return resolveGroupRank(slot, 2, context.groupStandings);
  if (slot.type === 'previous-match-winner' && context.matchWinners?.[slot.matchId]) return { teamId: context.matchWinners[slot.matchId], label: context.matchWinners[slot.matchId], unresolved: false };
  if (slot.type === 'previous-match-loser' && context.matchLosers?.[slot.matchId]) return { teamId: context.matchLosers[slot.matchId], label: context.matchLosers[slot.matchId], unresolved: false };
  return { label: formatBracketSlot(slot), unresolved: true };
}

function resolveGroupRank(slot: Extract<BracketSlot, { type: 'group-winner' | 'group-runner-up' }>, rank: number, standings?: Record<string, GroupStandingRef[]>): ResolvedSlot {
  const team = standings?.[slot.groupId]?.find((standing) => standing.rank === rank);
  return team ? { teamId: team.teamId, label: team.teamId, unresolved: false } : { label: formatBracketSlot(slot), unresolved: true };
}
