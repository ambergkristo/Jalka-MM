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

export interface PlayoffBracketFixture {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeTeamCode?: string;
  awayTeamCode?: string;
  homeLabel?: string;
  awayLabel?: string;
  homeScore?: number;
  awayScore?: number;
  kickoffAt?: string;
  status: BracketMatch['status'];
  winnerTeamId?: string;
}

export interface BuildPublicPlayoffBracketOptions {
  resolvedSlots?: Record<string, ResolvedBracketSlot>;
  fixturesByMatchId?: Map<number, PlayoffBracketFixture>;
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
  const bracketOptions = {
    ...options,
    resolvedSlots: buildResolvedSlots(options)
  };

  return {
    left: {
      side: 'LEFT',
      rounds: [
        round('left-r32', 'R32', 0, buildR32Matches('LEFT', 1, 8, 73, bracketOptions)),
        round('left-r16', 'R16', 1, buildWinnerMatches('LEFT', 'R16', 1, 4, 1, '1/16', 'r32', 89, bracketOptions)),
        round('left-qf', 'QF', 2, buildWinnerMatches('LEFT', 'QF', 1, 2, 1, '1/8', 'r16', 97, bracketOptions)),
        round('left-sf', 'SF', 3, buildWinnerMatches('LEFT', 'SF', 1, 1, 1, 'VF', 'qf', 101, bracketOptions))
      ]
    },
    right: {
      side: 'RIGHT',
      rounds: [
        round('right-r32', 'R32', 0, buildR32Matches('RIGHT', 9, 16, 81, bracketOptions)),
        round('right-r16', 'R16', 1, buildWinnerMatches('RIGHT', 'R16', 5, 8, 5, '1/16', 'r32', 93, bracketOptions)),
        round('right-qf', 'QF', 2, buildWinnerMatches('RIGHT', 'QF', 3, 4, 3, '1/8', 'r16', 99, bracketOptions)),
        round('right-sf', 'SF', 3, buildWinnerMatches('RIGHT', 'SF', 2, 2, 2, 'VF', 'qf', 102, bracketOptions))
      ]
    },
    final: applyFixtureData({
      id: 'final-1',
      stage: 'FINAL',
      side: 'CENTER',
      roundIndex: 4,
      order: 1,
      homeSlot: slot('winner-sf-1', 'PF-1 võitja', 'sf-1', bracketOptions),
      awaySlot: slot('winner-sf-2', 'PF-2 võitja', 'sf-2', bracketOptions),
      status: 'scheduled'
    }, 104, bracketOptions),
    thirdPlace: applyFixtureData({
      id: 'third-place',
      stage: 'THIRD_PLACE',
      side: 'CENTER',
      roundIndex: 4,
      order: 2,
      homeSlot: slot('loser-sf-1', 'PF-1 kaotaja', 'sf-1', bracketOptions),
      awaySlot: slot('loser-sf-2', 'PF-2 kaotaja', 'sf-2', bracketOptions),
      status: 'scheduled'
    }, 103, bracketOptions)
  };
}

function buildR32Matches(
  side: 'LEFT' | 'RIGHT',
  first: number,
  last: number,
  firstInternalMatchId: number,
  options: BuildPublicPlayoffBracketOptions
): BracketMatch[] {
  const matches: BracketMatch[] = [];
  for (let matchNumber = first; matchNumber <= last; matchNumber += 1) {
    const [homeLabel, awayLabel] = r32SlotPairs[matchNumber - 1];
    matches.push(applyFixtureData({
      id: `r32-${matchNumber}`,
      stage: 'R32',
      side,
      roundIndex: 0,
      order: matchNumber - first + 1,
      homeSlot: slot(`r32-${matchNumber}-home`, homeLabel, homeLabel, options),
      awaySlot: slot(`r32-${matchNumber}-away`, awayLabel, awayLabel, options),
      status: 'scheduled'
    }, firstInternalMatchId + (matchNumber - first), options));
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
  firstInternalMatchId: number,
  options: BuildPublicPlayoffBracketOptions
): BracketMatch[] {
  const matches: BracketMatch[] = [];
  for (let matchNumber = firstMatchNumber; matchNumber <= lastMatchNumber; matchNumber += 1) {
    const sourceOne = firstSourceMatchNumber + (matchNumber - firstMatchNumber) * 2;
    const sourceTwo = sourceOne + 1;
    matches.push(applyFixtureData({
      id: `${stage.toLowerCase()}-${matchNumber}`,
      stage,
      side,
      roundIndex: stage === 'R16' ? 1 : stage === 'QF' ? 2 : 3,
      order: matchNumber - firstMatchNumber + 1,
      homeSlot: slot(`winner-${sourceIdPrefix}-${sourceOne}`, `${sourceRoundLabel}-${sourceOne} võitja`, `${sourceIdPrefix}-${sourceOne}`, options),
      awaySlot: slot(`winner-${sourceIdPrefix}-${sourceTwo}`, `${sourceRoundLabel}-${sourceTwo} võitja`, `${sourceIdPrefix}-${sourceTwo}`, options),
      status: 'scheduled'
    }, firstInternalMatchId + (matchNumber - firstMatchNumber), options));
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

function applyFixtureData(match: BracketMatch, internalMatchId: number, options: BuildPublicPlayoffBracketOptions): BracketMatch {
  const fixture = options.fixturesByMatchId?.get(internalMatchId);
  if (!fixture) return match;

  return {
    ...match,
    homeSlot: {
      ...match.homeSlot,
      label: fixture.homeTeam,
      teamId: fixture.homeTeamId,
      teamName: fixture.homeTeam,
      teamCode: fixture.homeTeamCode,
      seedLabel: fixture.homeLabel ?? match.homeSlot.seedLabel
    },
    awaySlot: {
      ...match.awaySlot,
      label: fixture.awayTeam,
      teamId: fixture.awayTeamId,
      teamName: fixture.awayTeam,
      teamCode: fixture.awayTeamCode,
      seedLabel: fixture.awayLabel ?? match.awaySlot.seedLabel
    },
    homeScore: fixture.homeScore,
    awayScore: fixture.awayScore,
    winnerTeamId: fixture.winnerTeamId,
    kickoffUtc: fixture.kickoffAt,
    status: fixture.status
  };
}

function buildResolvedSlots(options: BuildPublicPlayoffBracketOptions): Record<string, ResolvedBracketSlot> | undefined {
  const resolvedSlots = { ...(options.resolvedSlots ?? {}) };
  for (const fixture of options.fixturesByMatchId?.values() ?? []) {
    const winnerSource = winnerSourceForMatchId(fixture.matchId);
    if (!winnerSource) continue;
    const winnerSlot = resolveWinnerSlot(fixture);
    if (winnerSlot) resolvedSlots[winnerSource] = winnerSlot;
  }

  return Object.keys(resolvedSlots).length > 0 ? resolvedSlots : undefined;
}

function resolveWinnerSlot(fixture: PlayoffBracketFixture): ResolvedBracketSlot | undefined {
  if (!fixture.winnerTeamId) return undefined;
  if (fixture.winnerTeamId === fixture.homeTeamId) {
    return {
      teamId: fixture.homeTeamId,
      teamName: fixture.homeTeam,
      teamCode: fixture.homeTeamCode
    };
  }
  if (fixture.winnerTeamId === fixture.awayTeamId) {
    return {
      teamId: fixture.awayTeamId,
      teamName: fixture.awayTeam,
      teamCode: fixture.awayTeamCode
    };
  }
  return undefined;
}

function winnerSourceForMatchId(matchId: number): string | undefined {
  if (matchId >= 73 && matchId <= 88) return `r32-${matchId - 72}`;
  if (matchId >= 89 && matchId <= 96) return `r16-${matchId - 88}`;
  if (matchId >= 97 && matchId <= 100) return `qf-${matchId - 96}`;
  if (matchId >= 101 && matchId <= 102) return `sf-${matchId - 100}`;
  return undefined;
}
