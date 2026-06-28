import type { BracketMatch, BracketTree } from '../../domain/publicBracket.js';
import type { PublicTournamentState } from './publicTournamentState.js';
import type { PlayerProfileView } from './predictionViewModels.js';

export type PlayoffBonusStatus = 'Ootel' | 'Täppi' | 'Möödas';

export interface PlayoffBonusRowView {
  label: string;
  predicted: string;
  actual: string;
  points: number;
  status: PlayoffBonusStatus;
}

export function buildPlayoffBonusRows(player: PlayerProfileView, state: PublicTournamentState): PlayoffBonusRowView[] {
  const tree = state.playoffBracket;
  const prediction = player.playoffPrediction;
  const topScorerActual = state.playedCount >= state.totalMatches ? state.topScorers[0]?.player : undefined;

  return [
    stageBonusRow('R16 õiged riigid', prediction.predictedRoundTeams.r16, collectStageTeams(tree, ['LEFT', 'RIGHT'], 1), 16, 15),
    stageBonusRow('Veerandfinaali õiged riigid', prediction.predictedRoundTeams.quarterFinal, collectStageTeams(tree, ['LEFT', 'RIGHT'], 2), 8, 20),
    stageBonusRow('Poolfinaali õiged riigid', prediction.predictedRoundTeams.semiFinal, collectStageTeams(tree, ['LEFT', 'RIGHT'], 3), 4, 25),
    stageBonusRow('Finaali õiged riigid', prediction.predictedRoundTeams.final, [tree.final.homeSlot.teamName, tree.final.awaySlot.teamName].filter(Boolean) as string[], 2, 30),
    winnerBonusRow('3. koha mängu võitja', prediction.predictedRoundTeams.thirdPlace[0] ?? prediction.thirdPlaceMatch?.predictedWinner ?? '', winnerFromMatch(tree.thirdPlace), 40),
    winnerBonusRow('MM võitja', prediction.predictedRoundTeams.champion, winnerFromMatch(tree.final), 100),
    winnerBonusRow('Parim väravakütt', prediction.topScorerPick, topScorerActual, 50)
  ];
}

function stageBonusRow(
  label: string,
  predictedTeams: string[],
  actualTeams: string[],
  expectedCount: number,
  pointsPerCorrectTeam: number
): PlayoffBonusRowView {
  const normalizedPredicted = new Set(predictedTeams.map(normalize));
  const normalizedActual = actualTeams.map((team) => team.trim()).filter(Boolean);
  const complete = normalizedActual.length >= expectedCount;
  const correctCount = normalizedActual.reduce((count, team) => count + (normalizedPredicted.has(normalize(team)) ? 1 : 0), 0);
  const allCorrect = complete && correctCount === normalizedActual.length;
  const status: PlayoffBonusStatus = !complete ? 'Ootel' : allCorrect ? 'Täppi' : 'Möödas';
  return {
    label,
    predicted: formatTeams(predictedTeams),
    actual: formatTeams(normalizedActual),
    points: complete ? correctCount * pointsPerCorrectTeam : 0,
    status
  };
}

function winnerBonusRow(label: string, predicted: string, actual: string | undefined, points: number): PlayoffBonusRowView {
  const hasActual = Boolean(actual);
  const status: PlayoffBonusStatus = !hasActual ? 'Ootel' : normalize(predicted) === normalize(actual ?? '') ? 'Täppi' : 'Möödas';
  return {
    label,
    predicted: predicted || 'Selgumisel',
    actual: actual || 'Ootel',
    points: status === 'Täppi' ? points : 0,
    status
  };
}

function collectStageTeams(tree: BracketTree, sides: Array<'LEFT' | 'RIGHT'>, roundIndex: 0 | 1 | 2 | 3): string[] {
  return sides.flatMap((side) => {
    const bracketSide = side === 'LEFT' ? tree.left : tree.right;
    return bracketSide.rounds[roundIndex]?.matches ?? [];
  }).flatMap(collectMatchTeams);
}

function collectMatchTeams(match: BracketMatch): string[] {
  return [match.homeSlot.teamName, match.awaySlot.teamName].filter((team): team is string => Boolean(team));
}

function winnerFromMatch(match: BracketMatch): string | undefined {
  if (!match.winnerTeamId) return undefined;
  if (match.winnerTeamId === match.homeSlot.teamId) return match.homeSlot.teamName;
  if (match.winnerTeamId === match.awaySlot.teamId) return match.awaySlot.teamName;
  return undefined;
}

function formatTeams(teams: string[]): string {
  if (teams.length === 0) return 'Ootel';
  return teams.join(', ');
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}
