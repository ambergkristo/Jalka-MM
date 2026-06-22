import type { ResultScorer } from './resultTypes.js';

export const MANUAL_UNKNOWN_SCORER_NAME = 'manual_unknown_scorer';

export interface ManualScorerCorrectionSet {
  matchId: number;
  scorers: ResultScorer[];
  source: string;
}

const MANUAL_SCORER_CORRECTIONS: ManualScorerCorrectionSet[] = [
  {
    matchId: 20,
    source: 'fifa.com',
    scorers: [
      { playerName: 'Marko Arnautović', teamCode: 'AUT', teamName: 'Austria', goals: 1 }
    ]
  },
  {
    matchId: 25,
    source: 'fifa.com',
    scorers: [
      { playerName: 'Teboho Mokoena', teamCode: 'RSA', teamName: 'South Africa', goals: 1 }
    ]
  },
  {
    matchId: 26,
    source: 'fifa.com',
    scorers: [
      { playerName: 'Granit Xhaka', teamCode: 'SUI', teamName: 'Switzerland', goals: 1 }
    ]
  }
];

export function getManualScorerCorrections(matchId: number): ResultScorer[] {
  return MANUAL_SCORER_CORRECTIONS.find((entry) => entry.matchId === matchId)?.scorers ?? [];
}

export function hasManualScorerCorrections(matchId: number): boolean {
  return getManualScorerCorrections(matchId).length > 0;
}

export function isManualUnknownScorerName(value: string | undefined): boolean {
  return value?.trim() === MANUAL_UNKNOWN_SCORER_NAME;
}
