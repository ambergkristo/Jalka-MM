import type {
  BonusScoreBreakdown,
  GroupBonusPrediction,
  GroupBonusResult,
  KnockoutBonusPrediction,
  KnockoutBonusResult,
  MatchPrediction,
  MatchResult,
  MatchScoreBreakdown,
  ParticipantScore,
  SlotSide
} from './types.js';

const resultSign = (home: number, away: number) => Math.sign(home - away);
const goalDifference = (home: number, away: number) => home - away;

export function validatePrediction(prediction: MatchPrediction): void {
  if (!Number.isInteger(prediction.homeGoals) || !Number.isInteger(prediction.awayGoals)) throw new Error('Goals must be whole numbers');
  if (prediction.homeGoals < 0 || prediction.awayGoals < 0) throw new Error('Goals cannot be negative');
  if (prediction.homeGoals === prediction.awayGoals && prediction.penaltyWinner !== undefined) validatePenaltyWinner(prediction.penaltyWinner);
}

export function requirePenaltyWinnerForTiedKnockout(prediction: MatchPrediction): void {
  validatePrediction(prediction);
  if (prediction.homeGoals === prediction.awayGoals && !prediction.penaltyWinner) throw new Error('Penalty winner is required for tied knockout predictions');
}

function validatePenaltyWinner(value: SlotSide): void {
  if (value !== 'HOME' && value !== 'AWAY') throw new Error('Penalty winner must be HOME or AWAY');
}

export function scoreMatch(prediction: MatchPrediction, actual: MatchResult): MatchScoreBreakdown {
  validatePrediction(prediction);
  if (prediction.homeGoals === actual.homeGoals && prediction.awayGoals === actual.awayGoals) return explain(prediction.matchId, 6, '6p: exact score correct');
  const predictedResult = resultSign(prediction.homeGoals, prediction.awayGoals);
  const actualResult = resultSign(actual.homeGoals, actual.awayGoals);
  if (predictedResult === actualResult) {
    if (goalDifference(prediction.homeGoals, prediction.awayGoals) === goalDifference(actual.homeGoals, actual.awayGoals)) return explain(prediction.matchId, 4, '4p: correct result and goal difference');
    return explain(prediction.matchId, 2, predictedResult === 0 ? '2p: correct draw' : '2p: correct winner');
  }
  return explain(prediction.matchId, 0, '0p: incorrect result');
}

function explain(matchId: number, points: number, explanation: string): MatchScoreBreakdown {
  return { matchId, points, explanation };
}

export function scoreGroupBonus(prediction: GroupBonusPrediction, actual: GroupBonusResult): BonusScoreBreakdown[] {
  const breakdowns: BonusScoreBreakdown[] = [];
  if (prediction.winnerTeamId === actual.winnerTeamId) breakdowns.push({ code: `${actual.groupId}:winner`, points: 10, explanation: `${actual.groupId}-grupi võitja tuletatud mänguennustustest: õige` });
  if (prediction.secondTeamId === actual.secondTeamId) breakdowns.push({ code: `${actual.groupId}:second`, points: 5, explanation: `${actual.groupId}-grupi teine koht tuletatud mänguennustustest: õige` });
  const actualQualifiers = new Set(actual.qualifierTeamIds);
  for (const teamId of unique(prediction.qualifierTeamIds)) {
    if (actualQualifiers.has(teamId)) breakdowns.push({ code: `${actual.groupId}:qualifier:${teamId}`, points: 3, explanation: 'Edasipääseja tuletatud alagrupimängude ennustustest: õige' });
  }
  return breakdowns;
}

export function scoreKnockoutBonus(prediction: KnockoutBonusPrediction, actual: KnockoutBonusResult): BonusScoreBreakdown[] {
  return [
    ...scoreRound('r16', 'Round of 16', 15, prediction.r16TeamIds, actual.r16TeamIds),
    ...scoreRound('qf', 'quarter-final', 20, prediction.qfTeamIds, actual.qfTeamIds),
    ...scoreRound('sf', 'semi-final', 25, prediction.sfTeamIds, actual.sfTeamIds),
    ...scoreRound('final', 'final', 30, prediction.finalTeamIds, actual.finalTeamIds),
    ...scoreSingle('third-place', 40, prediction.thirdPlaceWinnerTeamId, actual.thirdPlaceWinnerTeamId, '40p: correct third-place match winner'),
    ...scoreSingle('winner', 100, prediction.championTeamId, actual.championTeamId, '100p: correct World Cup winner'),
    ...scoreTopScorer(prediction.topScorer, actual.topScorers)
  ];
}

function scoreRound(code: string, label: string, points: number, predicted: string[], actual: string[]): BonusScoreBreakdown[] {
  const actualSet = new Set(actual);
  return unique(predicted).filter((teamId) => actualSet.has(teamId)).map((teamId) => ({ code: `${code}:${teamId}`, points, explanation: `${points}p: correct country in ${label}` }));
}

function scoreSingle(code: string, points: number, predicted: string, actual: string, explanation: string): BonusScoreBreakdown[] {
  return predicted === actual ? [{ code, points, explanation }] : [];
}

export function scoreTopScorer(predicted: string, actualTopScorers: string[]): BonusScoreBreakdown[] {
  const topScorers = unique(actualTopScorers.map((name) => name.trim()).filter(Boolean));
  if (!predicted.trim() || !topScorers.includes(predicted.trim())) return [];
  const points = 50 / topScorers.length;
  return [{ code: `top-scorer:${predicted.trim()}`, points, explanation: `${points}p: top scorer split across ${topScorers.length} tied player(s)` }];
}

export function rankParticipants(scores: ParticipantScore[]): ParticipantScore[] {
  return [...scores].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
  });
}

export function sumPoints(points: Array<{ points: number }>): number {
  return points.reduce((total, item) => total + item.points, 0);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
