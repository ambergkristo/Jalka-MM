import type {
  AwardsPrediction,
  GroupPrediction,
  KnockoutPrediction,
  KnockoutRound,
  LeaderboardEntry,
  Player,
  PlayerMatchPrediction
} from './predictionRepository.js';
import { getOfficialMatchPointCorrection } from './officialScoreCorrections.js';
import { resolveScorerIdentity } from './scorerIdentity.js';
import { normalizeTeamName, sameTeamName } from './teamNames.js';

export interface MatchResultForScoring {
  matchId: number;
  homeScore: number;
  awayScore: number;
  isFinal: boolean;
  penaltyWinner?: string;
}

export interface ActualGroupStanding {
  group: string;
  team: string;
  rank: number;
  qualified?: boolean;
  qualifierSource?: 'groupTop2' | 'providerKnockoutSlot' | 'mathematicalLock' | 'organizerLock' | 'notConfirmed';
  qualifierMatchId?: number;
  qualifierSlotLabel?: string;
}

export interface ActualKnockoutResults {
  stageTeams?: Partial<Record<KnockoutRound, string[]>>;
  thirdPlaceWinner?: string;
  champion?: string;
}

export interface ActualTopScorer {
  name: string;
  team?: string;
}

export interface MatchPointsBreakdown {
  matchId: number;
  points: number;
  exactScore: boolean;
  correctResult: boolean;
  correctGoalDifference: boolean;
}

export interface GroupBonusBreakdown {
  group: string;
  winnerPoints: number;
  secondPlacePoints: number;
  qualifierPoints: number;
  points: number;
}

export interface PlayoffBonusBreakdown {
  stage: 'R16' | 'QF' | 'SF' | 'Finalist' | 'ThirdPlaceWinner' | 'Champion';
  team: string;
  points: number;
}

export interface TopScorerBonusBreakdown {
  predictedTopScorer?: string;
  matched: boolean;
  points: number;
}

export interface PlayerPointsResult {
  playerId: string;
  points: number;
  totalPoints: number;
  matchPoints: number;
  groupBonusPoints: number;
  playoffBonusPoints: number;
  topScorerBonusPoints: number;
  exactScores: number;
  correctResults: number;
  hitRate: number;
  matchesScored: number;
  breakdown: MatchPointsBreakdown[];
  groupBreakdown: GroupBonusBreakdown[];
  playoffBreakdown: PlayoffBonusBreakdown[];
  topScorerBreakdown: TopScorerBonusBreakdown;
  warnings: string[];
}

export interface RebuildLeaderboardResult {
  entries: LeaderboardEntry[];
  playerResults: PlayerPointsResult[];
  warnings: string[];
}

export function calculateMatchPredictionPoints(prediction: PlayerMatchPrediction, result: MatchResultForScoring): MatchPointsBreakdown {
  if (!result.isFinal) return emptyMatchBreakdown(result.matchId);

  const exactScore = prediction.homeScore === result.homeScore && prediction.awayScore === result.awayScore;
  const correctResult = outcome(prediction.homeScore, prediction.awayScore) === outcome(result.homeScore, result.awayScore);
  const correctGoalDifference = goalDifference(prediction.homeScore, prediction.awayScore) === goalDifference(result.homeScore, result.awayScore);

  return {
    matchId: result.matchId,
    points: exactScore ? 6 : correctResult && correctGoalDifference ? 4 : correctResult ? 2 : 0,
    exactScore,
    correctResult,
    correctGoalDifference
  };
}

export function calculateGroupBonusPoints(
  groupPredictions: GroupPrediction[],
  actualGroupStandings?: ActualGroupStanding[]
): { points: number; breakdown: GroupBonusBreakdown[]; warnings: string[] } {
  if (!actualGroupStandings?.length) {
    return { points: 0, breakdown: [], warnings: ['Group bonus skipped: actual group standings are not available.'] };
  }

  const standingsByGroup = groupBy(actualGroupStandings, (standing) => standing.group);
  const breakdown: GroupBonusBreakdown[] = [];
  const warnings: string[] = [];

  for (const prediction of groupPredictions) {
    const standings = standingsByGroup.get(prediction.group);
    if (!standings?.length) {
      warnings.push(`Group bonus skipped for group ${prediction.group}: actual standings are not available.`);
      continue;
    }

    const actualWinner = standings.find((standing) => standing.rank === 1)?.team;
    const actualSecond = standings.find((standing) => standing.rank === 2)?.team;
    const winnerPoints = actualWinner && sameTeam(prediction.first, actualWinner) ? 10 : 0;
    const secondPlacePoints = actualSecond && sameTeam(prediction.second, actualSecond) ? 5 : 0;
    const actualQualifiers = new Set(
      standings.filter((standing) => standing.qualified === true || standing.rank <= 2).map((standing) => normalizeName(standing.team))
    );
    const qualifierAwardedTeams = new Set<string>();
    const qualifierPoints = [
      { predictedTeam: prediction.first, exactPlacement: actualWinner ? sameTeam(prediction.first, actualWinner) : false },
      { predictedTeam: prediction.second, exactPlacement: actualSecond ? sameTeam(prediction.second, actualSecond) : false },
      { predictedTeam: prediction.third, exactPlacement: false }
    ].reduce((sum, row) => {
      if (!row.predictedTeam) return sum;
      const normalizedTeam = normalizeName(row.predictedTeam);
      if (!actualQualifiers.has(normalizedTeam) || row.exactPlacement || qualifierAwardedTeams.has(normalizedTeam)) return sum;
      qualifierAwardedTeams.add(normalizedTeam);
      return sum + 3;
    }, 0);

    breakdown.push({
      group: prediction.group,
      winnerPoints,
      secondPlacePoints,
      qualifierPoints,
      points: winnerPoints + secondPlacePoints + qualifierPoints
    });
  }

  return { points: breakdown.reduce((sum, row) => sum + row.points, 0), breakdown, warnings };
}

export function calculatePlayoffBonusPoints(input: {
  knockoutPrediction?: KnockoutPrediction;
  actualKnockoutResults?: ActualKnockoutResults;
  championPrediction?: string;
  thirdPlaceWinnerPrediction?: string;
}): { points: number; breakdown: PlayoffBonusBreakdown[]; warnings: string[] } {
  if (!input.actualKnockoutResults) {
    return { points: 0, breakdown: [], warnings: ['Playoff bonus skipped: actual knockout results are not available.'] };
  }

  const breakdown: PlayoffBonusBreakdown[] = [];
  const warnings: string[] = [];
  const stageTeams = input.actualKnockoutResults.stageTeams ?? {};

  addStageBonus(breakdown, input.knockoutPrediction, stageTeams.R16, 'R16', 'R16', 15);
  addStageBonus(breakdown, input.knockoutPrediction, stageTeams.QF, 'QF', 'QF', 20);
  addStageBonus(breakdown, input.knockoutPrediction, stageTeams.SF, 'SF', 'SF', 25);
  addStageBonus(breakdown, input.knockoutPrediction, stageTeams.Final, 'Final', 'Finalist', 30);

  const thirdPlaceWinnerPrediction = input.thirdPlaceWinnerPrediction ?? input.knockoutPrediction?.thirdPlaceWinner;
  if (
    thirdPlaceWinnerPrediction &&
    input.actualKnockoutResults.thirdPlaceWinner &&
    sameTeam(thirdPlaceWinnerPrediction, input.actualKnockoutResults.thirdPlaceWinner)
  ) {
    breakdown.push({ stage: 'ThirdPlaceWinner', team: thirdPlaceWinnerPrediction, points: 40 });
  }

  if (input.championPrediction && input.actualKnockoutResults.champion && sameTeam(input.championPrediction, input.actualKnockoutResults.champion)) {
    breakdown.push({ stage: 'Champion', team: input.championPrediction, points: 100 });
  }

  if (!input.knockoutPrediction && !input.championPrediction) warnings.push('Playoff bonus skipped: player has no knockout or champion prediction.');
  return { points: breakdown.reduce((sum, row) => sum + row.points, 0), breakdown, warnings };
}

export function calculateTopScorerBonus(
  awardsPrediction?: AwardsPrediction,
  actualTopScorers?: ActualTopScorer[]
): { points: number; breakdown: TopScorerBonusBreakdown; warnings: string[] } {
  if (!actualTopScorers?.length) {
    return {
      points: 0,
      breakdown: { predictedTopScorer: awardsPrediction?.topScorerName, matched: false, points: 0 },
      warnings: ['Top scorer bonus skipped: actual top scorer data is not available.']
    };
  }

  const predicted = awardsPrediction?.topScorerName;
  const matched = Boolean(predicted && actualTopScorers.some((scorer) => sameScorer(predicted, scorer.name)));
  return {
    points: matched ? 50 : 0,
    breakdown: { predictedTopScorer: predicted, matched, points: matched ? 50 : 0 },
    warnings: predicted ? [] : ['Top scorer bonus skipped: player has no top scorer prediction.']
  };
}

export function calculatePlayerPoints(
  playerId: string,
  predictions: PlayerMatchPrediction[],
  results: MatchResultForScoring[],
  options: {
    groupPredictions?: GroupPrediction[];
    actualGroupStandings?: ActualGroupStanding[];
    knockoutPrediction?: KnockoutPrediction;
    actualKnockoutResults?: ActualKnockoutResults;
    awardsPrediction?: AwardsPrediction;
    actualTopScorers?: ActualTopScorer[];
  } = {}
): PlayerPointsResult {
  const resultByMatch = new Map(results.filter((result) => result.isFinal).map((result) => [result.matchId, result]));
  const breakdown = predictions
    .filter((prediction) => prediction.playerId === playerId)
    .flatMap((prediction) => {
      const result = resultByMatch.get(prediction.matchId);
      return result ? [calculateMatchPredictionPoints(prediction, result)] : [];
    })
    .map((row) => applyOfficialPointCorrection(playerId, row));

  const groupBonus = calculateGroupBonusPoints(options.groupPredictions ?? [], options.actualGroupStandings);
  const playoffBonus = calculatePlayoffBonusPoints({
      knockoutPrediction: options.knockoutPrediction,
      actualKnockoutResults: options.actualKnockoutResults,
      championPrediction: options.awardsPrediction?.championTeam,
      thirdPlaceWinnerPrediction: options.knockoutPrediction?.thirdPlaceWinner
    });
  const topScorerBonus = calculateTopScorerBonus(options.awardsPrediction, options.actualTopScorers);

  const matchesScored = breakdown.length;
  const correctResults = breakdown.filter((item) => item.correctResult).length;
  const exactScores = breakdown.filter((item) => item.exactScore).length;
  const matchPoints = breakdown.reduce((sum, item) => sum + item.points, 0);
  const totalPoints = matchPoints + groupBonus.points + playoffBonus.points + topScorerBonus.points;

  return {
    playerId,
    points: totalPoints,
    totalPoints,
    matchPoints,
    groupBonusPoints: groupBonus.points,
    playoffBonusPoints: playoffBonus.points,
    topScorerBonusPoints: topScorerBonus.points,
    exactScores,
    correctResults,
    hitRate: matchesScored === 0 ? 0 : correctResults / matchesScored,
    matchesScored,
    breakdown,
    groupBreakdown: groupBonus.breakdown,
    playoffBreakdown: playoffBonus.breakdown,
    topScorerBreakdown: topScorerBonus.breakdown,
    warnings: [...groupBonus.warnings, ...playoffBonus.warnings, ...topScorerBonus.warnings]
  };
}

export function rebuildLeaderboard(input: {
  players: Player[];
  predictions: PlayerMatchPrediction[];
  results: MatchResultForScoring[];
  groupPredictions?: GroupPrediction[];
  actualGroupStandings?: ActualGroupStanding[];
  knockoutPredictions?: KnockoutPrediction[];
  actualKnockoutResults?: ActualKnockoutResults;
  awardsPredictions?: AwardsPrediction[];
  actualTopScorers?: ActualTopScorer[];
  previousEntries?: LeaderboardEntry[];
  recalculatedAt: string;
}): RebuildLeaderboardResult {
  const warnings: string[] = [];
  if (input.results.filter((result) => result.isFinal).length === 0) warnings.push('No finalized match results available for leaderboard rebuild.');
  if (input.predictions.length === 0) warnings.push('No match prediction seed data available for leaderboard rebuild.');
  if (!input.actualGroupStandings?.length) warnings.push('Group bonus points were skipped because actual group standings are not available.');
  if (!input.actualKnockoutResults) warnings.push('Playoff bonus points were skipped because actual knockout results are not available.');
  if (!input.actualTopScorers?.length) warnings.push('Top scorer bonus points were skipped because actual top scorer data is not available.');

  const previousRankByPlayer = new Map((input.previousEntries ?? []).map((entry) => [entry.playerId, entry.rank]));
  const groupPredictionsByPlayer = groupBy(input.groupPredictions ?? [], (prediction) => prediction.playerId);
  const knockoutPredictionByPlayer = new Map((input.knockoutPredictions ?? []).map((prediction) => [prediction.playerId, prediction]));
  const awardsPredictionByPlayer = new Map((input.awardsPredictions ?? []).map((prediction) => [prediction.playerId, prediction]));
  const playerResults = input.players.map((player) =>
    calculatePlayerPoints(player.id, input.predictions, input.results, {
      groupPredictions: groupPredictionsByPlayer.get(player.id),
      actualGroupStandings: input.actualGroupStandings,
      knockoutPrediction: knockoutPredictionByPlayer.get(player.id),
      actualKnockoutResults: input.actualKnockoutResults,
      awardsPrediction: awardsPredictionByPlayer.get(player.id),
      actualTopScorers: input.actualTopScorers
    })
  );

  const rankedResults = [...playerResults].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores;
    if (b.correctResults !== a.correctResults) return b.correctResults - a.correctResults;
    return a.playerId.localeCompare(b.playerId);
  });

  const entries = rankedResults.map((result, index) => ({
    playerId: result.playerId,
    rank: index + 1,
    points: result.totalPoints,
    exactScores: result.exactScores,
    correctResults: result.correctResults,
    hitRate: result.hitRate,
    matchesScored: result.matchesScored,
    matchPoints: result.matchPoints,
    groupBonusPoints: result.groupBonusPoints,
    playoffBonusPoints: result.playoffBonusPoints,
    topScorerBonusPoints: result.topScorerBonusPoints,
    totalPoints: result.totalPoints,
    previousRank: previousRankByPlayer.get(result.playerId),
    lastUpdatedAt: input.recalculatedAt
  }));

  return { entries, playerResults, warnings: unique(warnings) };
}

function addStageBonus(
  breakdown: PlayoffBonusBreakdown[],
  prediction: KnockoutPrediction | undefined,
  actualTeams: string[] | undefined,
  predictionRound: KnockoutRound,
  stage: PlayoffBonusBreakdown['stage'],
  points: number
): void {
  if (!prediction || !actualTeams?.length) return;
  const predictedTeams = new Set((prediction.rounds.find((round) => round.round === predictionRound)?.teams ?? []).map(normalizeName));
  for (const actualTeam of actualTeams) {
    if (predictedTeams.has(normalizeName(actualTeam))) breakdown.push({ stage, team: actualTeam, points });
  }
}

function emptyMatchBreakdown(matchId: number): MatchPointsBreakdown {
  return { matchId, points: 0, exactScore: false, correctResult: false, correctGoalDifference: false };
}

function outcome(homeScore: number, awayScore: number): 'HOME' | 'DRAW' | 'AWAY' {
  if (homeScore > awayScore) return 'HOME';
  if (homeScore < awayScore) return 'AWAY';
  return 'DRAW';
}

function goalDifference(homeScore: number, awayScore: number): number {
  return homeScore - awayScore;
}

function sameTeam(left: string, right: string): boolean {
  return sameTeamName(left, right);
}

function sameScorer(left: string, right: string): boolean {
  const leftIdentity = resolveScorerIdentity({ playerName: left });
  const rightIdentity = resolveScorerIdentity({ playerName: right });
  return leftIdentity.lookupKey === rightIdentity.lookupKey;
}

function normalizeName(value: string): string {
  return normalizeTeamName(value);
}

function applyOfficialPointCorrection(playerId: string, breakdown: MatchPointsBreakdown): MatchPointsBreakdown {
  const correction = getOfficialMatchPointCorrection(playerId, breakdown.matchId);
  if (!correction || correction.points === breakdown.points) return breakdown;

  return {
    ...breakdown,
    points: correction.points,
    exactScore: correction.points === 6,
    correctResult: correction.points > 0,
    correctGoalDifference: correction.points === 4 || correction.points === 6
  };
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const groupKey = key(row);
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), row]);
  }
  return groups;
}

function unique<T>(rows: T[]): T[] {
  return [...new Set(rows)];
}
