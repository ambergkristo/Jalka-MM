import type { GroupBonusPrediction, GroupTieResolution, Match, MatchPrediction, Team } from './types.js';

export interface PredictedGroupStanding {
  teamId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  rank: number | null;
  status: 'advanced' | 'third_possible' | 'out' | 'unresolved';
}

export interface GroupTieIssue {
  groupId: string;
  teamIds: string[];
  reason: 'group_rank' | 'third_place_cutoff';
}

export interface PredictedGroupOutcome {
  groupId: string;
  standings: PredictedGroupStanding[];
  winnerTeamId?: string;
  secondTeamId?: string;
  thirdTeamId?: string;
  qualifierTeamIds: string[];
  unresolvedTies: GroupTieIssue[];
}

export interface PredictedTournamentGroups {
  groups: PredictedGroupOutcome[];
  groupBonuses: GroupBonusPrediction[];
  advancingThirdPlaceTeamIds: string[];
  unresolvedTies: GroupTieIssue[];
}

interface MutableStanding extends PredictedGroupStanding {}

const THIRD_PLACE_GROUP_ID = 'THIRD_PLACE';

export function derivePredictedGroupOutcomes(teams: Team[], matches: Match[], predictions: MatchPrediction[], resolutions: GroupTieResolution[] = []): PredictedTournamentGroups {
  const predictionByMatch = new Map(predictions.map((prediction) => [prediction.matchId, prediction]));
  const resolutionByGroup = new Map(resolutions.map((resolution) => [resolution.groupId, resolution.teamOrder]));
  const groupIds = unique(teams.map((team: any) => team.groupId ?? team.group_id).filter(Boolean) as string[]);
  const groups = groupIds.map((groupId) => deriveOneGroup(groupId, teams, matches, predictionByMatch, resolutionByGroup.get(groupId) ?? []));
  const thirdPlace = groups.filter((group) => group.thirdTeamId && group.unresolvedTies.length === 0).map((group) => {
    const standing = group.standings.find((item) => item.teamId === group.thirdTeamId)!;
    return { groupId: group.groupId, standing };
  });
  let thirdIssues: GroupTieIssue[] = [];
  let advancingThirdPlaceTeamIds: string[] = [];
  if (thirdPlace.length === 12) {
    const thirdTieOrder = resolutionByGroup.get(THIRD_PLACE_GROUP_ID) ?? [];
    const sortedThirds = sortThirdPlaceTeams(thirdPlace, thirdTieOrder);
    const cutoffTie = tiedCutoff(sortedThirds.map((item) => item.standing), 8, thirdTieOrder);
    if (cutoffTie.length > 0) thirdIssues = [{ groupId: THIRD_PLACE_GROUP_ID, teamIds: cutoffTie, reason: 'third_place_cutoff' }];
    advancingThirdPlaceTeamIds = sortedThirds.slice(0, 8).map((item) => item.standing.teamId);
  }

  const allUnresolved = [...groups.flatMap((group) => group.unresolvedTies), ...thirdIssues];
  const withStatuses = groups.map((group) => ({
    ...group,
    qualifierTeamIds: [
      ...group.qualifierTeamIds,
      ...(group.thirdTeamId && advancingThirdPlaceTeamIds.includes(group.thirdTeamId) ? [group.thirdTeamId] : [])
    ],
    standings: group.standings.map((standing) => ({
      ...standing,
      status: statusForStanding(standing, group.thirdTeamId, advancingThirdPlaceTeamIds)
    }))
  }));

  return {
    groups: withStatuses,
    groupBonuses: withStatuses.filter((group) => group.winnerTeamId && group.secondTeamId && group.unresolvedTies.length === 0).map((group) => ({
      groupId: group.groupId,
      winnerTeamId: group.winnerTeamId!,
      secondTeamId: group.secondTeamId!,
      qualifierTeamIds: group.qualifierTeamIds
    })),
    advancingThirdPlaceTeamIds,
    unresolvedTies: allUnresolved
  };
}

function deriveOneGroup(groupId: string, teams: Team[], matches: Match[], predictionByMatch: Map<number, MatchPrediction>, tieOrder: string[]): PredictedGroupOutcome {
  const groupTeams = teams.filter((team) => team.groupId === groupId || (team as any).group_id === groupId);
  const standings = new Map(groupTeams.map((team) => [team.id, emptyStanding(team.id)]));
  for (const match of matches.filter((item) => item.stage === 'GROUP' && (item.groupId === groupId || (item as any).group_id === groupId))) {
    const homeTeamId = match.homeTeamId ?? (match as any).home_team_id;
    const awayTeamId = match.awayTeamId ?? (match as any).away_team_id;
    const prediction = predictionByMatch.get(match.id);
    if (!homeTeamId || !awayTeamId || !prediction || !Number.isInteger(prediction.homeGoals) || !Number.isInteger(prediction.awayGoals)) continue;
    applyResult(standings.get(homeTeamId)!, prediction.homeGoals, prediction.awayGoals);
    applyResult(standings.get(awayTeamId)!, prediction.awayGoals, prediction.homeGoals);
  }

  const groupMatches = matches.filter((item) => item.stage === 'GROUP' && (item.groupId === groupId || (item as any).group_id === groupId));
  const sorted = applyHeadToHead(sortStandings([...standings.values()]), groupMatches, predictionByMatch);
  const unresolvedTies: GroupTieIssue[] = [];
  const resolved = applyTieOrder(sorted, tieOrder, groupId, unresolvedTies);
  return {
    groupId,
    standings: resolved.map((standing, index) => ({ ...standing, rank: index + 1, status: 'out' })),
    winnerTeamId: unresolvedTies.length ? undefined : resolved[0]?.teamId,
    secondTeamId: unresolvedTies.length ? undefined : resolved[1]?.teamId,
    thirdTeamId: unresolvedTies.length ? undefined : resolved[2]?.teamId,
    qualifierTeamIds: unresolvedTies.length ? [] : [resolved[0]?.teamId, resolved[1]?.teamId].filter(Boolean) as string[],
    unresolvedTies
  };
}

function sortStandings(standings: MutableStanding[]): MutableStanding[] {
  return standings.sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.teamId.localeCompare(b.teamId));
}

function applyHeadToHead(sorted: MutableStanding[], groupMatches: Match[], predictionByMatch: Map<number, MatchPrediction>): MutableStanding[] {
  const output: MutableStanding[] = [];
  for (let index = 0; index < sorted.length;) {
    const tied = sorted.filter((item) => sameRankKey(item, sorted[index]));
    index += tied.length;
    if (tied.length < 2) {
      output.push(tied[0]);
      continue;
    }
    const mini = new Map(tied.map((team) => [team.teamId, emptyStanding(team.teamId)]));
    const tiedIds = new Set(tied.map((team) => team.teamId));
    for (const match of groupMatches) {
      const homeTeamId = match.homeTeamId ?? (match as any).home_team_id;
      const awayTeamId = match.awayTeamId ?? (match as any).away_team_id;
      if (!tiedIds.has(homeTeamId) || !tiedIds.has(awayTeamId)) continue;
      const prediction = predictionByMatch.get(match.id);
      if (!prediction) continue;
      applyResult(mini.get(homeTeamId)!, prediction.homeGoals, prediction.awayGoals);
      applyResult(mini.get(awayTeamId)!, prediction.awayGoals, prediction.homeGoals);
    }
    const miniSorted = sortStandings([...mini.values()]);
    const stillTied = miniSorted.some((team, teamIndex) => teamIndex > 0 && sameRankKey(team, miniSorted[teamIndex - 1]));
    output.push(...(stillTied ? tied : miniSorted.map((team) => tied.find((item) => item.teamId === team.teamId)!)));
  }
  return output;
}

function sortThirdPlaceTeams(thirds: Array<{ groupId: string; standing: PredictedGroupStanding }>, tieOrder: string[]) {
  return thirds.sort((a, b) => {
    const base = b.standing.points - a.standing.points || b.standing.goalDifference - a.standing.goalDifference || b.standing.goalsFor - a.standing.goalsFor;
    if (base !== 0) return base;
    const ai = tieOrder.indexOf(a.standing.teamId);
    const bi = tieOrder.indexOf(b.standing.teamId);
    if (ai >= 0 && bi >= 0) return ai - bi;
    return a.groupId.localeCompare(b.groupId);
  });
}

function applyTieOrder(sorted: MutableStanding[], tieOrder: string[], groupId: string, unresolvedTies: GroupTieIssue[]): MutableStanding[] {
  const output: MutableStanding[] = [];
  for (let index = 0; index < sorted.length;) {
    const tied = sorted.filter((item) => sameRankKey(item, sorted[index]));
    const blockStart = index;
    index += tied.length;
    if (tied.length === 1) {
      output.push(tied[0]);
      continue;
    }
    const relevant = blockStart < 3;
    const hasResolution = tied.every((team) => tieOrder.includes(team.teamId));
    if (relevant && !hasResolution) unresolvedTies.push({ groupId, teamIds: tied.map((team) => team.teamId), reason: 'group_rank' });
    output.push(...(hasResolution ? tied.sort((a, b) => tieOrder.indexOf(a.teamId) - tieOrder.indexOf(b.teamId)) : tied));
  }
  return output;
}

function tiedCutoff(sorted: PredictedGroupStanding[], cutoff: number, tieOrder: string[]): string[] {
  const before = sorted[cutoff - 1];
  const after = sorted[cutoff];
  if (!before || !after || !sameRankKey(before, after)) return [];
  const tied = sorted.filter((item) => sameRankKey(item, before)).map((item) => item.teamId);
  return tied.every((teamId) => tieOrder.includes(teamId)) ? [] : tied;
}

function sameRankKey(a: PredictedGroupStanding, b: PredictedGroupStanding): boolean {
  return a.points === b.points && a.goalDifference === b.goalDifference && a.goalsFor === b.goalsFor;
}

function statusForStanding(standing: PredictedGroupStanding, thirdTeamId: string | undefined, advancingThirds: string[]): PredictedGroupStanding['status'] {
  if (standing.rank === 1 || standing.rank === 2) return 'advanced';
  if (standing.teamId === thirdTeamId) return advancingThirds.includes(standing.teamId) ? 'advanced' : 'third_possible';
  return standing.rank ? 'out' : 'unresolved';
}

function emptyStanding(teamId: string): MutableStanding {
  return { teamId, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, rank: null, status: 'out' };
}

function applyResult(standing: MutableStanding, goalsFor: number, goalsAgainst: number) {
  standing.played += 1;
  standing.goalsFor += goalsFor;
  standing.goalsAgainst += goalsAgainst;
  standing.goalDifference = standing.goalsFor - standing.goalsAgainst;
  if (goalsFor > goalsAgainst) {
    standing.wins += 1;
    standing.points += 3;
  } else if (goalsFor === goalsAgainst) {
    standing.draws += 1;
    standing.points += 1;
  } else {
    standing.losses += 1;
  }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
