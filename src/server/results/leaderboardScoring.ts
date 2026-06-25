import { rebuildLeaderboard, type MatchResultForScoring, type PlayerPointsResult, type RebuildLeaderboardResult } from '../../domain/pointsEngine.js';
import { predictionRepository, type GroupPrediction, type LeaderboardEntry, type PredictionRepository } from '../../domain/predictionRepository.js';
import type { ActualGroupStanding } from '../../domain/pointsEngine.js';
import type { QueryableDatabase } from '../databaseAdapter.js';
import { buildConfiguredActualScoringState, type ActualScoringState, type GroupQualifierAudit, type QualifierSource } from './scoringState.js';
import type { LeaderboardRepository } from './leaderboardRepository.js';
import type { ResultUpdate, ResultsAgentRepository } from './resultTypes.js';

export interface LeaderboardScoringBreakdownMatch {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  predictedHomeScore?: number;
  predictedAwayScore?: number;
  actualHomeScore: number;
  actualAwayScore: number;
  rawHomeScore?: number;
  rawAwayScore?: number;
  points: number;
  exactScore: boolean;
  correctResult: boolean;
  correctGoalDifference: boolean;
  scoreSource: 'confirmed' | 'raw';
}

export interface LeaderboardScoringBreakdown {
  playerId: string;
  playerName: string;
  recalculatedAt: string;
  finalizedGroups: string[];
  qualifierAudit: GroupQualifierAudit;
  thirdPlaceQualifierAwards: Array<{
    group: string;
    team: string;
    source: Exclude<QualifierSource, 'groupTop2' | 'notConfirmed'>;
    points: number;
  }>;
  persistedEntry?: LeaderboardEntry;
  rebuiltEntry: LeaderboardEntry;
  playerResult: PlayerPointsResult;
  matches: LeaderboardScoringBreakdownMatch[];
}

export function toScoringMatchResult(result: ResultUpdate): MatchResultForScoring | undefined {
  const resolved = resolveScoringResult(result);
  if (!resolved) return undefined;
  return {
    matchId: result.matchId,
    homeScore: resolved.homeScore,
    awayScore: resolved.awayScore,
    isFinal: result.isFinal
  };
}

export function resolveScoringResult(result: ResultUpdate): { homeScore: number; awayScore: number; scoreSource: 'confirmed' | 'raw' } | undefined {
  if (typeof result.confirmedHomeScore === 'number' && typeof result.confirmedAwayScore === 'number') {
    return {
      homeScore: result.confirmedHomeScore,
      awayScore: result.confirmedAwayScore,
      scoreSource: 'confirmed'
    };
  }
  if (typeof result.homeScore === 'number' && typeof result.awayScore === 'number') {
    return {
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      scoreSource: 'raw'
    };
  }
  return undefined;
}

export async function buildLeaderboardScoringBreakdown(input: {
  database: QueryableDatabase;
  resultsRepository: ResultsAgentRepository;
  leaderboardRepository: LeaderboardRepository;
  playerQuery: string;
  now?: Date;
  predictionSource?: PredictionRepository;
  actualScoringState?: ActualScoringState;
}): Promise<LeaderboardScoringBreakdown> {
  const now = input.now ?? new Date();
  const predictionSource = input.predictionSource ?? predictionRepository;
  const player = resolvePlayer(predictionSource, input.playerQuery);
  if (!player) throw new Error(`Player not found: ${input.playerQuery}`);

  const [finalizedResults, trackedMatches, persistedEntries] = await Promise.all([
    input.resultsRepository.getFinalizedResults(),
    input.resultsRepository.listTrackedMatches(),
    input.leaderboardRepository.getLeaderboard()
  ]);
  const actualScoringState = input.actualScoringState ?? (
    finalizedResults.length > 0 ? await buildConfiguredActualScoringState(input.database, now) : undefined
  );
  const rebuilt = rebuildLeaderboard({
    players: predictionSource.getPlayers(),
    predictions: predictionSource.getMatchPredictions(),
    groupPredictions: predictionSource.getGroupPredictions(),
    knockoutPredictions: predictionSource.getKnockoutPredictions(),
    awardsPredictions: predictionSource.getAwardsPredictions(),
    results: finalizedResults.flatMap((result) => {
      const scoringResult = toScoringMatchResult(result);
      return scoringResult ? [scoringResult] : [];
    }),
    actualGroupStandings: actualScoringState?.actualGroupStandings,
    actualKnockoutResults: actualScoringState?.actualKnockoutResults,
    actualTopScorers: actualScoringState?.actualTopScorers,
    previousEntries: persistedEntries,
    recalculatedAt: now.toISOString()
  });
  const rebuiltEntry = rebuilt.entries.find((entry) => entry.playerId === player.id);
  const playerResult = rebuilt.playerResults.find((result) => result.playerId === player.id);
  if (!rebuiltEntry || !playerResult) throw new Error(`Scoring breakdown is unavailable for player ${player.id}`);

  const persistedEntry = persistedEntries.find((entry) => entry.playerId === player.id);
  const predictionByMatch = new Map(predictionSource.getMatchPredictions(player.id).map((prediction) => [prediction.matchId, prediction]));
  const groupPredictionByGroup = new Map(predictionSource.getGroupPredictions(player.id).map((prediction) => [prediction.group, prediction]));
  const trackedMatchById = new Map(trackedMatches.map((match) => [match.id, match]));
  const breakdownByMatchId = new Map(playerResult.breakdown.map((row) => [row.matchId, row]));
  const standingsByGroup = groupBy(actualScoringState?.actualGroupStandings ?? [], (standing) => standing.group);

  const matches = finalizedResults.flatMap((result) => {
    const score = resolveScoringResult(result);
    const breakdown = breakdownByMatchId.get(result.matchId);
    if (!score || !breakdown) return [];
    const trackedMatch = trackedMatchById.get(result.matchId);
    const prediction = predictionByMatch.get(result.matchId);
    return [{
      matchId: result.matchId,
      homeTeam: trackedMatch?.homeTeam ?? `Match ${result.matchId}`,
      awayTeam: trackedMatch?.awayTeam ?? '',
      predictedHomeScore: prediction?.homeScore,
      predictedAwayScore: prediction?.awayScore,
      actualHomeScore: score.homeScore,
      actualAwayScore: score.awayScore,
      rawHomeScore: result.homeScore,
      rawAwayScore: result.awayScore,
      points: breakdown.points,
      exactScore: breakdown.exactScore,
      correctResult: breakdown.correctResult,
      correctGoalDifference: breakdown.correctGoalDifference,
      scoreSource: score.scoreSource
    }];
  }).sort((left, right) => left.matchId - right.matchId);

  return {
    playerId: player.id,
    playerName: player.name,
    recalculatedAt: now.toISOString(),
    finalizedGroups: unique(actualScoringState?.actualGroupStandings?.map((standing) => standing.group) ?? []),
    qualifierAudit: actualScoringState?.qualifierAudit ?? {
      confirmedDirectQualifiers: unique(actualScoringState?.actualGroupStandings?.map((standing) => standing.group) ?? [])
        .sort()
        .map((group) => ({
          group,
          teams: (actualScoringState?.actualGroupStandings ?? [])
            .filter((standing) => standing.group === group && (standing.qualifierSource === 'groupTop2' || (!standing.qualifierSource && standing.rank <= 2)))
            .sort((left, right) => left.rank - right.rank)
            .map((standing) => standing.team)
        })),
      confirmedThirdPlaceQualifiers: (actualScoringState?.actualGroupStandings ?? [])
        .filter((standing) => standing.rank === 3 && standing.qualified && standing.qualifierSource && standing.qualifierSource !== 'groupTop2' && standing.qualifierSource !== 'notConfirmed')
        .map((standing) => ({
          group: standing.group,
          team: standing.team,
          source: standing.qualifierSource as Exclude<QualifierSource, 'groupTop2' | 'notConfirmed'>,
          matchId: standing.qualifierMatchId,
          slotLabel: standing.qualifierSlotLabel
        }))
    },
    thirdPlaceQualifierAwards: collectThirdPlaceQualifierAwards(groupPredictionByGroup, standingsByGroup),
    persistedEntry,
    rebuiltEntry,
    playerResult,
    matches
  };
}

function resolvePlayer(predictionSource: PredictionRepository, query: string) {
  const normalizedQuery = normalize(query);
  return predictionSource.getPlayers().find((player) => normalize(player.id) === normalizedQuery || normalize(player.name) === normalizedQuery);
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('et');
}

function unique<T>(rows: T[]): T[] {
  return [...new Set(rows)];
}

function collectThirdPlaceQualifierAwards(
  groupPredictionByGroup: Map<string, GroupPrediction>,
  standingsByGroup: Map<string, ActualGroupStanding[]>
): Array<{
  group: string;
  team: string;
  source: Exclude<QualifierSource, 'groupTop2' | 'notConfirmed'>;
  points: number;
}> {
  const awards: Array<{
    group: string;
    team: string;
    source: Exclude<QualifierSource, 'groupTop2' | 'notConfirmed'>;
    points: number;
  }> = [];

  for (const [group, prediction] of groupPredictionByGroup.entries()) {
    const standings = standingsByGroup.get(group) ?? [];
    const thirdPlace = standings.find((standing) =>
      standing.rank === 3 &&
      standing.qualified &&
      standing.qualifierSource &&
      standing.qualifierSource !== 'groupTop2' &&
      standing.qualifierSource !== 'notConfirmed'
    );
    if (!thirdPlace) continue;

    const actualWinner = standings.find((standing) => standing.rank === 1)?.team;
    const actualSecond = standings.find((standing) => standing.rank === 2)?.team;
    const awardedTeams = new Set<string>();
    const predictedRows = [
      { team: prediction.first, exactPlacement: actualWinner ? sameTeam(prediction.first, actualWinner) : false },
      { team: prediction.second, exactPlacement: actualSecond ? sameTeam(prediction.second, actualSecond) : false },
      { team: prediction.third, exactPlacement: false }
    ];
    for (const row of predictedRows) {
      if (!row.team || row.exactPlacement) continue;
      if (!sameTeam(row.team, thirdPlace.team)) continue;
      const normalizedTeam = normalizeTeam(row.team);
      if (awardedTeams.has(normalizedTeam)) continue;
      awardedTeams.add(normalizedTeam);
      awards.push({
        group,
        team: thirdPlace.team,
        source: thirdPlace.qualifierSource as Exclude<QualifierSource, 'groupTop2' | 'notConfirmed'>,
        points: 3
      });
    }
  }

  return awards.sort((left, right) => left.group.localeCompare(right.group, 'et') || left.team.localeCompare(right.team, 'et'));
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const groupKey = key(row);
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), row]);
  }
  return groups;
}

function sameTeam(left: string, right: string): boolean {
  return normalizeTeam(left) === normalizeTeam(right);
}

function normalizeTeam(value: string): string {
  return value.trim().toLocaleLowerCase('et');
}
