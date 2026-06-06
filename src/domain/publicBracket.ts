export type BracketStage = 'R32' | 'R16' | 'QF' | 'SF' | 'FINAL' | 'THIRD_PLACE';
export type BracketSideName = 'LEFT' | 'RIGHT' | 'CENTER';

export interface BracketSlot {
  id: string;
  label: string;
  source?: string;
  teamId?: string;
  teamName?: string;
  teamCode?: string;
  seedLabel?: string;
}

export interface BracketMatch {
  id: string;
  stage: BracketStage;
  side: BracketSideName;
  roundIndex: number;
  order: number;
  homeSlot: BracketSlot;
  awaySlot: BracketSlot;
  homeScore?: number;
  awayScore?: number;
  winnerTeamId?: string;
  status: 'scheduled' | 'live' | 'finished' | 'extra-time' | 'penalties';
  kickoffUtc?: string;
}

export interface BracketRound {
  id: string;
  label: string;
  roundIndex: number;
  matches: BracketMatch[];
}

export interface BracketSide {
  side: Exclude<BracketSideName, 'CENTER'>;
  rounds: BracketRound[];
}

export interface BracketTree {
  left: BracketSide;
  right: BracketSide;
  final: BracketMatch;
  thirdPlace: BracketMatch;
}

export interface ResolvedBracketSlot {
  teamId: string;
  teamName: string;
  teamCode?: string;
}

export interface BuildPublicPlayoffBracketOptions {
  resolvedSlots?: Record<string, ResolvedBracketSlot>;
}

const roundLabels: Record<Exclude<BracketStage, 'FINAL' | 'THIRD_PLACE'>, string> = {
  R32: '1/16-finaalid',
  R16: '1/8-finaalid',
  QF: 'Veerandfinaalid',
  SF: 'Poolfinaal'
};

const r32SlotPairs = [
  ['A1', 'Parim 3. koht'],
  ['B2', 'C2'],
  ['D1', 'Parim 3. koht'],
  ['E1', 'F2'],
  ['G1', 'Parim 3. koht'],
  ['H2', 'I2'],
  ['J1', 'Parim 3. koht'],
  ['K1', 'L2'],
  ['B1', 'Parim 3. koht'],
  ['A2', 'D2'],
  ['F1', 'Parim 3. koht'],
  ['H1', 'G2'],
  ['I1', 'Parim 3. koht'],
  ['J2', 'K2'],
  ['L1', 'Parim 3. koht'],
  ['C1', 'E2']
] as const;

export function buildPublicPlayoffBracketTree(options: BuildPublicPlayoffBracketOptions = {}): BracketTree {
  const leftR32 = buildR32Matches('LEFT', 1, 8, options);
  const rightR32 = buildR32Matches('RIGHT', 9, 16, options);

  return {
    left: {
      side: 'LEFT',
      rounds: [
        round('left-r32', 'R32', 0, leftR32),
        round('left-r16', 'R16', 1, buildWinnerMatches('LEFT', 'R16', 1, 4, 1, '1/16', 'r32', options)),
        round('left-qf', 'QF', 2, buildWinnerMatches('LEFT', 'QF', 1, 2, 1, '1/8', 'r16', options)),
        round('left-sf', 'SF', 3, buildWinnerMatches('LEFT', 'SF', 1, 1, 1, 'VF', 'qf', options))
      ]
    },
    right: {
      side: 'RIGHT',
      rounds: [
        round('right-r32', 'R32', 0, rightR32),
        round('right-r16', 'R16', 1, buildWinnerMatches('RIGHT', 'R16', 5, 8, 5, '1/16', 'r32', options)),
        round('right-qf', 'QF', 2, buildWinnerMatches('RIGHT', 'QF', 3, 4, 3, '1/8', 'r16', options)),
        round('right-sf', 'SF', 3, buildWinnerMatches('RIGHT', 'SF', 2, 2, 2, 'VF', 'qf', options))
      ]
    },
    final: {
      id: 'final-1',
      stage: 'FINAL',
      side: 'CENTER',
      roundIndex: 4,
      order: 1,
      homeSlot: slot('winner-sf-1', 'PF-1 võitja', 'sf-1', options),
      awaySlot: slot('winner-sf-2', 'PF-2 võitja', 'sf-2', options),
      status: 'scheduled'
    },
    thirdPlace: {
      id: 'third-place',
      stage: 'THIRD_PLACE',
      side: 'CENTER',
      roundIndex: 4,
      order: 2,
      homeSlot: slot('loser-sf-1', 'PF-1 kaotaja', 'sf-1', options),
      awaySlot: slot('loser-sf-2', 'PF-2 kaotaja', 'sf-2', options),
      status: 'scheduled'
    }
  };
}

function buildR32Matches(side: 'LEFT' | 'RIGHT', first: number, last: number, options: BuildPublicPlayoffBracketOptions): BracketMatch[] {
  const matches: BracketMatch[] = [];
  for (let matchNumber = first; matchNumber <= last; matchNumber += 1) {
    const [homeLabel, awayLabel] = r32SlotPairs[matchNumber - 1];
    matches.push({
      id: `r32-${matchNumber}`,
      stage: 'R32',
      side,
      roundIndex: 0,
      order: matchNumber - first + 1,
      homeSlot: slot(`r32-${matchNumber}-home`, homeLabel, homeLabel, options),
      awaySlot: slot(`r32-${matchNumber}-away`, awayLabel, awayLabel, options),
      status: 'scheduled'
    });
  }
  return matches;
}

function buildWinnerMatches(
  side: 'LEFT' | 'RIGHT',
  stage: Exclude<BracketStage, 'R32' | 'FINAL' | 'THIRD_PLACE'>,
  firstMatchNumber: number,
  lastMatchNumber: number,
  firstSourceMatchNumber: number,
  sourceRoundLabel: string,
  sourceIdPrefix: string,
  options: BuildPublicPlayoffBracketOptions
): BracketMatch[] {
  const matches: BracketMatch[] = [];
  for (let matchNumber = firstMatchNumber; matchNumber <= lastMatchNumber; matchNumber += 1) {
    const sourceOne = firstSourceMatchNumber + (matchNumber - firstMatchNumber) * 2;
    const sourceTwo = sourceOne + 1;
    matches.push({
      id: `${stage.toLowerCase()}-${matchNumber}`,
      stage,
      side,
      roundIndex: stage === 'R16' ? 1 : stage === 'QF' ? 2 : 3,
      order: matchNumber - firstMatchNumber + 1,
      homeSlot: slot(`winner-${sourceIdPrefix}-${sourceOne}`, `${sourceRoundLabel}-${sourceOne} võitja`, `${sourceIdPrefix}-${sourceOne}`, options),
      awaySlot: slot(`winner-${sourceIdPrefix}-${sourceTwo}`, `${sourceRoundLabel}-${sourceTwo} võitja`, `${sourceIdPrefix}-${sourceTwo}`, options),
      status: 'scheduled'
    });
  }
  return matches;
}

function round(id: string, stage: Exclude<BracketStage, 'FINAL' | 'THIRD_PLACE'>, roundIndex: number, matches: BracketMatch[]): BracketRound {
  return {
    id,
    label: roundLabels[stage],
    roundIndex,
    matches
  };
}

function slot(id: string, label: string, source: string, options: BuildPublicPlayoffBracketOptions): BracketSlot {
  const resolved = options.resolvedSlots?.[source] ?? options.resolvedSlots?.[id];
  if (resolved) {
    return {
      id,
      label: resolved.teamName,
      source,
      teamId: resolved.teamId,
      teamName: resolved.teamName,
      teamCode: resolved.teamCode,
      seedLabel: label
    };
  }
  return {
    id,
    label,
    source,
    seedLabel: label
  };
}
