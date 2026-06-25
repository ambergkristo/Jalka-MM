import type { QueryableDatabase } from '../databaseAdapter.js';
import { calculatePlayerPoints, rebuildLeaderboard, type ActualGroupStanding, type ActualKnockoutResults, type ActualTopScorer } from '../../domain/pointsEngine.js';
import { predictionRepository, type AwardsPrediction, type GroupPrediction, type KnockoutPrediction, type LeaderboardEntry, type Player, type PlayerMatchPrediction } from '../../domain/predictionRepository.js';
import { buildCanonicalPublicLeaderboardEntries } from '../../domain/publicLeaderboard.js';
import type { PredictionLeagueInsightCard, PredictionLeagueInsights } from '../../domain/predictionLeagueInsights.js';
import { resolveScorerIdentity } from '../../domain/scorerIdentity.js';
import { CONFIRMED_FINAL_RESULT_SQL } from './finalizedResultState.js';
import { MANUAL_UNKNOWN_SCORER_NAME } from './manualScorerCorrections.js';

interface MatchCatalogRow {
  matchId: number;
  stage: string;
  groupId?: string;
  kickoffAt: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamCode?: string;
  awayTeamCode?: string;
}

interface ConfirmedMatchRow extends MatchCatalogRow {
  homeScore: number;
  awayScore: number;
  penaltyWinnerTeamId?: string;
  penaltyWinnerTeamCode?: string;
}

interface TeamRow {
  id: string;
  name: string;
  nameEt?: string;
  code?: string;
  groupId?: string;
}

interface ScorerFactRow {
  matchId: number;
  playerId?: string;
  providerPlayerId?: string;
  playerName: string;
  teamId?: string;
  teamCode?: string;
  goals: number;
}

interface DailySnapshot {
  dayKey: string;
  entries: LeaderboardEntry[];
}

interface StreakMetrics {
  currentCorrect: number;
  currentMiss: number;
  longestCorrect: number;
  longestMiss: number;
}

interface PredictionLeagueRepositoryLike {
  getPlayers(): Player[];
  getMatchPredictions(playerId?: string): PlayerMatchPrediction[];
  getGroupPredictions(playerId?: string): GroupPrediction[];
  getKnockoutPredictions(playerId?: string): KnockoutPrediction[];
  getAwardsPredictions(playerId?: string): AwardsPrediction[];
}

const PREDICTION_CARD_FALLBACK = 'Andmed puuduvad';
const NO_KNOCKOUT_TEXT = 'Playoff pole veel alanud';
const NO_MATCHES_TEXT = 'Kinnitatud mänge veel ei ole';

export async function getPredictionLeagueInsights(
  db: QueryableDatabase,
  leaderboardEntries: LeaderboardEntry[],
  now = new Date()
): Promise<PredictionLeagueInsights> {
  const [teams, allMatches, confirmedMatches, scorerFacts] = await Promise.all([
    loadTeams(db),
    loadAllMatches(db),
    loadConfirmedMatches(db),
    loadScorerFacts(db)
  ]);

  return buildPredictionLeagueInsights({
    teams,
    allMatches,
    confirmedMatches,
    scorerFacts,
    leaderboardEntries,
    now
  });
}

export function buildPredictionLeagueInsights(input: {
  teams: TeamRow[];
  allMatches: MatchCatalogRow[];
  confirmedMatches: ConfirmedMatchRow[];
  scorerFacts: ScorerFactRow[];
  leaderboardEntries: LeaderboardEntry[];
  now: Date;
  repository?: PredictionLeagueRepositoryLike;
}): PredictionLeagueInsights {
  const repository = input.repository ?? predictionRepository;
  const players = repository.getPlayers();
  const playerNameById = new Map(players.map((player) => [player.id, player.name]));
  const currentEntries = buildCanonicalEntries(players, input.leaderboardEntries);
  const currentState = buildActualState({
    teams: input.teams,
    allMatches: input.allMatches,
    confirmedMatches: input.confirmedMatches,
    scorerFacts: input.scorerFacts
  });
  const dailySnapshots = buildDailySnapshots(input, repository);
  const streaksByPlayer = buildStreakMetricsByPlayer(repository, players.map((player) => player.id), input.confirmedMatches);
  const totalPointsAwarded = currentEntries.reduce((sum, entry) => sum + (entry.totalPoints ?? entry.points), 0);
  const totalExactScores = currentEntries.reduce((sum, entry) => sum + entry.exactScores, 0);
  const latestRiseFall = buildLatestDailyMovement(dailySnapshots);
  const historicalMovement = buildHistoricalMovementRecords(dailySnapshots);
  const highestMatchday = buildHighestSingleMatchdayRecord(dailySnapshots);
  const currentLeader = currentEntries[0];
  const rankedByHitRate = currentEntries
    .filter((entry) => (entry.matchesScored ?? 0) > 0)
    .sort((left, right) =>
      right.hitRate - left.hitRate ||
      (right.matchesScored ?? 0) - (left.matchesScored ?? 0) ||
      right.exactScores - left.exactScores ||
      playerLabel(playerNameById, left.playerId).localeCompare(playerLabel(playerNameById, right.playerId), 'et')
    );
  const rankedByExacts = [...currentEntries].sort((left, right) =>
    right.exactScores - left.exactScores ||
    right.points - left.points ||
    playerLabel(playerNameById, left.playerId).localeCompare(playerLabel(playerNameById, right.playerId), 'et')
  );
  const rankedByBonus = [...currentEntries].sort((left, right) =>
    bonusPoints(right) - bonusPoints(left) ||
    right.points - left.points ||
    playerLabel(playerNameById, left.playerId).localeCompare(playerLabel(playerNameById, right.playerId), 'et')
  );
  const rankedByCurrentCorrectStreak = sortPlayersByStreak(players.map((player) => player.id), streaksByPlayer, 'currentCorrect', playerNameById);
  const rankedByCurrentMissStreak = sortPlayersByStreak(players.map((player) => player.id), streaksByPlayer, 'currentMiss', playerNameById);
  const rankedByLongestCorrectStreak = sortPlayersByStreak(players.map((player) => player.id), streaksByPlayer, 'longestCorrect', playerNameById);
  const rankedByLongestMissStreak = sortPlayersByStreak(players.map((player) => player.id), streaksByPlayer, 'longestMiss', playerNameById);
  const groupPredictor = buildBestGroupStagePredictor(repository, input.confirmedMatches, currentState.actualGroupStandings, playerNameById);
  const knockoutPredictor = buildBestKnockoutPredictor(repository, input.confirmedMatches, currentState.actualKnockoutResults, playerNameById);

  return {
    statistics: {
      eyebrow: 'Live',
      title: 'Ennustusliiga statistika',
      cards: [
        rankedByHitRate[0]
          ? createPlayerCard({
            id: 'highest-hit-rate',
            title: 'Highest hit rate',
            badge: '%',
            tone: 'purple',
            value: formatPercent(rankedByHitRate[0].hitRate),
            subject: playerLabel(playerNameById, rankedByHitRate[0].playerId),
            detail: `${rankedByHitRate[0].exactScores} täpset skoori`
          })
          : unavailableCard('highest-hit-rate', 'Highest hit rate', '%', 'purple', NO_MATCHES_TEXT),
        rankedByExacts[0]
          ? createPlayerCard({
            id: 'most-exact-scores',
            title: 'Most exact scores',
            badge: '6',
            tone: 'purple',
            value: String(rankedByExacts[0].exactScores),
            subject: playerLabel(playerNameById, rankedByExacts[0].playerId),
            detail: `${rankedByExacts[0].points} punkti kokku`
          })
          : unavailableCard('most-exact-scores', 'Most exact scores', '6', 'purple', NO_MATCHES_TEXT),
        latestRiseFall.rise
          ? createPlayerCard({
            id: 'biggest-rise-today',
            title: 'Biggest rise today',
            badge: '+',
            tone: 'green',
            value: `+${latestRiseFall.rise.delta}`,
            subject: playerLabel(playerNameById, latestRiseFall.rise.playerId),
            detail: `${latestRiseFall.rise.dayLabel} tõus`
          })
          : unavailableCard('biggest-rise-today', 'Biggest rise today', '+', 'green', 'Tänaseid tõuse veel ei ole'),
        latestRiseFall.fall
          ? createPlayerCard({
            id: 'biggest-fall-today',
            title: 'Biggest fall today',
            badge: '-',
            tone: 'red',
            value: `-${latestRiseFall.fall.delta}`,
            subject: playerLabel(playerNameById, latestRiseFall.fall.playerId),
            detail: `${latestRiseFall.fall.dayLabel} langus`
          })
          : unavailableCard('biggest-fall-today', 'Biggest fall today', '-', 'red', 'Tänaseid langusi veel ei ole'),
        rankedByCurrentCorrectStreak[0] && streakValue(streaksByPlayer, rankedByCurrentCorrectStreak[0], 'currentCorrect') > 0
          ? createPlayerCard({
            id: 'current-correct-streak',
            title: 'Longest current correct prediction streak',
            badge: 'St',
            tone: 'green',
            value: String(streakValue(streaksByPlayer, rankedByCurrentCorrectStreak[0], 'currentCorrect')),
            subject: playerLabel(playerNameById, rankedByCurrentCorrectStreak[0]),
            detail: 'järjestikust punktiga mängu'
          })
          : unavailableCard('current-correct-streak', 'Longest current correct prediction streak', 'St', 'green', NO_MATCHES_TEXT),
        rankedByCurrentMissStreak[0] && streakValue(streaksByPlayer, rankedByCurrentMissStreak[0], 'currentMiss') > 0
          ? createPlayerCard({
            id: 'current-no-point-streak',
            title: 'Longest current no-point streak',
            badge: '0',
            tone: 'red',
            value: String(streakValue(streaksByPlayer, rankedByCurrentMissStreak[0], 'currentMiss')),
            subject: playerLabel(playerNameById, rankedByCurrentMissStreak[0]),
            detail: 'järjestikust nullimängu'
          })
          : unavailableCard('current-no-point-streak', 'Longest current no-point streak', '0', 'red', NO_MATCHES_TEXT),
        createMetricCard({
          id: 'total-points-awarded',
          title: 'Total points awarded',
          badge: 'Pt',
          tone: 'blue',
          value: String(totalPointsAwarded),
          subject: `${players.length} mängijat`,
          detail: 'kõigile mängijatele kokku'
        }),
        createMetricCard({
          id: 'average-points',
          title: 'Average points per player',
          badge: 'Av',
          tone: 'blue',
          value: formatDecimal(totalPointsAwarded / Math.max(players.length, 1)),
          subject: `${players.length} mängijat`,
          detail: 'keskmine punktisumma'
        }),
        createMetricCard({
          id: 'average-exacts',
          title: 'Average exact scores per player',
          badge: 'Ex',
          tone: 'blue',
          value: formatDecimal(totalExactScores / Math.max(players.length, 1)),
          subject: `${players.length} mängijat`,
          detail: 'täpset skoori mängija kohta'
        })
      ]
    },
    records: {
      eyebrow: 'Rekordid',
      title: 'Rekordid',
      cards: [
        currentLeader
          ? createPlayerCard({
            id: 'current-leader',
            title: 'Current tournament leader',
            badge: '1',
            tone: 'gold',
            value: `${currentLeader.points} p`,
            subject: playerLabel(playerNameById, currentLeader.playerId),
            detail: `${ordinal(currentLeader.rank)} koht`
          })
          : unavailableCard('current-leader', 'Current tournament leader', '1', 'gold', NO_MATCHES_TEXT),
        currentLeader
          ? createPlayerCard({
            id: 'highest-score',
            title: 'Highest score',
            badge: 'Hi',
            tone: 'gold',
            value: `${currentLeader.points} p`,
            subject: playerLabel(playerNameById, currentLeader.playerId),
            detail: 'kõrgeim koguskoor'
          })
          : unavailableCard('highest-score', 'Highest score', 'Hi', 'gold', NO_MATCHES_TEXT),
        rankedByExacts[0]
          ? createPlayerCard({
            id: 'record-most-exacts',
            title: 'Most exact scores',
            badge: '6',
            tone: 'gold',
            value: String(rankedByExacts[0].exactScores),
            subject: playerLabel(playerNameById, rankedByExacts[0].playerId),
            detail: `${rankedByExacts[0].points} punkti`
          })
          : unavailableCard('record-most-exacts', 'Most exact scores', '6', 'gold', NO_MATCHES_TEXT),
        rankedByHitRate[0]
          ? createPlayerCard({
            id: 'record-highest-hit-rate',
            title: 'Highest hit %',
            badge: '%',
            tone: 'gold',
            value: formatPercent(rankedByHitRate[0].hitRate),
            subject: playerLabel(playerNameById, rankedByHitRate[0].playerId),
            detail: `${rankedByHitRate[0].matchesScored ?? 0} hinnatud mängu`
          })
          : unavailableCard('record-highest-hit-rate', 'Highest hit %', '%', 'gold', NO_MATCHES_TEXT),
        highestMatchday
          ? createPlayerCard({
            id: 'highest-single-matchday-score',
            title: 'Highest single matchday score',
            badge: 'Md',
            tone: 'gold',
            value: `${highestMatchday.points} p`,
            subject: playerLabel(playerNameById, highestMatchday.playerId),
            detail: highestMatchday.dayLabel
          })
          : unavailableCard('highest-single-matchday-score', 'Highest single matchday score', 'Md', 'gold', NO_MATCHES_TEXT),
        historicalMovement.rise
          ? createPlayerCard({
            id: 'largest-climb',
            title: 'Largest climb in one day',
            badge: '+',
            tone: 'green',
            value: `+${historicalMovement.rise.delta}`,
            subject: playerLabel(playerNameById, historicalMovement.rise.playerId),
            detail: historicalMovement.rise.dayLabel
          })
          : unavailableCard('largest-climb', 'Largest climb in one day', '+', 'green', 'Ühe päeva tõuse veel ei ole'),
        historicalMovement.fall
          ? createPlayerCard({
            id: 'largest-drop',
            title: 'Largest drop in one day',
            badge: '-',
            tone: 'red',
            value: `-${historicalMovement.fall.delta}`,
            subject: playerLabel(playerNameById, historicalMovement.fall.playerId),
            detail: historicalMovement.fall.dayLabel
          })
          : unavailableCard('largest-drop', 'Largest drop in one day', '-', 'red', 'Ühe päeva langusi veel ei ole'),
        rankedByLongestCorrectStreak[0] && streakValue(streaksByPlayer, rankedByLongestCorrectStreak[0], 'longestCorrect') > 0
          ? createPlayerCard({
            id: 'longest-correct-streak',
            title: 'Longest correct prediction streak',
            badge: 'St',
            tone: 'green',
            value: String(streakValue(streaksByPlayer, rankedByLongestCorrectStreak[0], 'longestCorrect')),
            subject: playerLabel(playerNameById, rankedByLongestCorrectStreak[0]),
            detail: 'punktimängu järjest'
          })
          : unavailableCard('longest-correct-streak', 'Longest correct prediction streak', 'St', 'green', NO_MATCHES_TEXT),
        rankedByLongestMissStreak[0] && streakValue(streaksByPlayer, rankedByLongestMissStreak[0], 'longestMiss') > 0
          ? createPlayerCard({
            id: 'longest-no-point-streak',
            title: 'Longest no-point streak',
            badge: '0',
            tone: 'red',
            value: String(streakValue(streaksByPlayer, rankedByLongestMissStreak[0], 'longestMiss')),
            subject: playerLabel(playerNameById, rankedByLongestMissStreak[0]),
            detail: 'nullimängu järjest'
          })
          : unavailableCard('longest-no-point-streak', 'Longest no-point streak', '0', 'red', NO_MATCHES_TEXT),
        rankedByBonus[0] && bonusPoints(rankedByBonus[0]) > 0
          ? createPlayerCard({
            id: 'most-bonus-points',
            title: 'Most points earned from bonus scoring',
            badge: 'Bn',
            tone: 'gold',
            value: `${bonusPoints(rankedByBonus[0])} p`,
            subject: playerLabel(playerNameById, rankedByBonus[0].playerId),
            detail: 'boonusarvestus kokku'
          })
          : unavailableCard('most-bonus-points', 'Most points earned from bonus scoring', 'Bn', 'gold', 'Boone veel ei ole'),
        groupPredictor
          ? createPlayerCard({
            id: 'best-group-stage-predictor',
            title: 'Best group-stage predictor',
            badge: 'Gr',
            tone: 'purple',
            value: `${groupPredictor.points} p`,
            subject: playerLabel(playerNameById, groupPredictor.playerId),
            detail: 'alagruppide arvestus'
          })
          : unavailableCard('best-group-stage-predictor', 'Best group-stage predictor', 'Gr', 'purple', NO_MATCHES_TEXT),
        knockoutPredictor
          ? createPlayerCard({
            id: 'best-knockout-predictor',
            title: 'Best knockout predictor',
            badge: 'Ko',
            tone: 'purple',
            value: `${knockoutPredictor.points} p`,
            subject: playerLabel(playerNameById, knockoutPredictor.playerId),
            detail: 'playoffi arvestus'
          })
          : unavailableCard('best-knockout-predictor', 'Best knockout predictor', 'Ko', 'purple', NO_KNOCKOUT_TEXT)
      ]
    }
  };
}

async function loadTeams(db: QueryableDatabase): Promise<TeamRow[]> {
  const rows = await db.all(`
    SELECT id, name, name_et, code, group_id
    FROM teams
    ORDER BY id
  `);
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    nameEt: stringOrUndefined(row.name_et),
    code: stringOrUndefined(row.code),
    groupId: stringOrUndefined(row.group_id)
  }));
}

async function loadAllMatches(db: QueryableDatabase): Promise<MatchCatalogRow[]> {
  const rows = await db.all(`
    SELECT
      m.id,
      m.stage,
      m.group_id,
      m.kickoff_at,
      m.home_team_id,
      m.away_team_id,
      COALESCE(home.name_et, home.name, m.home_slot) AS home_team,
      COALESCE(away.name_et, away.name, m.away_slot) AS away_team,
      home.code AS home_team_code,
      away.code AS away_team_code
    FROM matches m
    LEFT JOIN teams home ON home.id = m.home_team_id
    LEFT JOIN teams away ON away.id = m.away_team_id
    ORDER BY m.kickoff_at, m.id
  `);
  return rows.map(toMatchCatalogRow);
}

async function loadConfirmedMatches(db: QueryableDatabase): Promise<ConfirmedMatchRow[]> {
  const rows = await db.all(`
    SELECT
      m.id,
      m.stage,
      m.group_id,
      m.kickoff_at,
      m.home_team_id,
      m.away_team_id,
      COALESCE(home.name_et, home.name, m.home_slot) AS home_team,
      COALESCE(away.name_et, away.name, m.away_slot) AS away_team,
      home.code AS home_team_code,
      away.code AS away_team_code,
      COALESCE(r.confirmed_home_score, r.home_score) AS home_score,
      COALESCE(r.confirmed_away_score, r.away_score) AS away_score,
      c.penalty_winner_team_id,
      c.penalty_winner_team_code
    FROM match_results r
    JOIN matches m ON m.id = r.match_id
    LEFT JOIN teams home ON home.id = m.home_team_id
    LEFT JOIN teams away ON away.id = m.away_team_id
    LEFT JOIN (
      SELECT c1.*
      FROM result_manual_corrections c1
      JOIN (
        SELECT match_id, MAX(created_at) AS created_at
        FROM result_manual_corrections
        GROUP BY match_id
      ) latest
        ON latest.match_id = c1.match_id AND latest.created_at = c1.created_at
    ) c ON c.match_id = m.id
    WHERE ${CONFIRMED_FINAL_RESULT_SQL}
    ORDER BY m.kickoff_at, m.id
  `);
  return rows.map((row) => ({
    ...toMatchCatalogRow(row),
    homeScore: Number(row.home_score ?? 0),
    awayScore: Number(row.away_score ?? 0),
    penaltyWinnerTeamId: stringOrUndefined(row.penalty_winner_team_id),
    penaltyWinnerTeamCode: stringOrUndefined(row.penalty_winner_team_code)
  }));
}

async function loadScorerFacts(db: QueryableDatabase): Promise<ScorerFactRow[]> {
  const rows = await db.all(`
    SELECT match_id, player_id, provider_player_id, player_name, team_id, team_code, goals
    FROM result_manual_scorers
    WHERE COALESCE(goals, 0) > 0
    ORDER BY match_id, created_at, player_name
  `);
  return rows.map((row) => ({
    matchId: Number(row.match_id),
    playerId: stringOrUndefined(row.player_id),
    providerPlayerId: stringOrUndefined(row.provider_player_id),
    playerName: String(row.player_name ?? ''),
    teamId: stringOrUndefined(row.team_id),
    teamCode: stringOrUndefined(row.team_code),
    goals: Number(row.goals ?? 0)
  }));
}

function buildDailySnapshots(input: {
  teams: TeamRow[];
  allMatches: MatchCatalogRow[];
  confirmedMatches: ConfirmedMatchRow[];
  scorerFacts: ScorerFactRow[];
  now: Date;
}, repository: PredictionLeagueRepositoryLike): DailySnapshot[] {
  const grouped = groupBy(input.confirmedMatches, (match) => toTallinnDayKey(match.kickoffAt));
  const dayKeys = [...grouped.keys()].sort();
  const snapshots: DailySnapshot[] = [];
  const cumulativeMatches: ConfirmedMatchRow[] = [];
  let previousEntries: LeaderboardEntry[] = [];

  for (const dayKey of dayKeys) {
    cumulativeMatches.push(...(grouped.get(dayKey) ?? []));
    const cumulativeMatchIds = new Set(cumulativeMatches.map((match) => match.matchId));
    const state = buildActualState({
      teams: input.teams,
      allMatches: input.allMatches,
      confirmedMatches: cumulativeMatches,
      scorerFacts: input.scorerFacts.filter((fact) => cumulativeMatchIds.has(fact.matchId))
    });
    const rebuilt = rebuildLeaderboard({
      players: repository.getPlayers(),
      predictions: repository.getMatchPredictions(),
      groupPredictions: repository.getGroupPredictions(),
      knockoutPredictions: repository.getKnockoutPredictions(),
      awardsPredictions: repository.getAwardsPredictions(),
      results: toScoringResults(cumulativeMatches),
      actualGroupStandings: state.actualGroupStandings,
      actualKnockoutResults: state.actualKnockoutResults,
      actualTopScorers: state.actualTopScorers,
      previousEntries,
      recalculatedAt: input.now.toISOString()
    });
    previousEntries = rebuilt.entries;
    snapshots.push({ dayKey, entries: rebuilt.entries });
  }

  return snapshots;
}

function buildLatestDailyMovement(dailySnapshots: DailySnapshot[]): {
  rise?: { playerId: string; delta: number; dayLabel: string };
  fall?: { playerId: string; delta: number; dayLabel: string };
} {
  if (dailySnapshots.length < 2) return {};
  const current = dailySnapshots[dailySnapshots.length - 1];
  const previous = dailySnapshots[dailySnapshots.length - 2];
  const previousRankByPlayer = new Map(previous.entries.map((entry) => [entry.playerId, entry.rank]));
  const dayLabel = formatDayLabel(current.dayKey);

  let rise: { playerId: string; delta: number; dayLabel: string } | undefined;
  let fall: { playerId: string; delta: number; dayLabel: string } | undefined;

  for (const entry of current.entries) {
    const previousRank = previousRankByPlayer.get(entry.playerId);
    if (!previousRank) continue;
    const climb = previousRank - entry.rank;
    const drop = entry.rank - previousRank;
    if (climb > 0 && (!rise || climb > rise.delta)) rise = { playerId: entry.playerId, delta: climb, dayLabel };
    if (drop > 0 && (!fall || drop > fall.delta)) fall = { playerId: entry.playerId, delta: drop, dayLabel };
  }

  return { rise, fall };
}

function buildHistoricalMovementRecords(dailySnapshots: DailySnapshot[]): {
  rise?: { playerId: string; delta: number; dayLabel: string };
  fall?: { playerId: string; delta: number; dayLabel: string };
} {
  let rise: { playerId: string; delta: number; dayLabel: string } | undefined;
  let fall: { playerId: string; delta: number; dayLabel: string } | undefined;

  for (let index = 1; index < dailySnapshots.length; index += 1) {
    const current = dailySnapshots[index];
    const previous = dailySnapshots[index - 1];
    const previousRankByPlayer = new Map(previous.entries.map((entry) => [entry.playerId, entry.rank]));
    const dayLabel = formatDayLabel(current.dayKey);

    for (const entry of current.entries) {
      const previousRank = previousRankByPlayer.get(entry.playerId);
      if (!previousRank) continue;
      const climb = previousRank - entry.rank;
      const drop = entry.rank - previousRank;
      if (climb > 0 && (!rise || climb > rise.delta)) rise = { playerId: entry.playerId, delta: climb, dayLabel };
      if (drop > 0 && (!fall || drop > fall.delta)) fall = { playerId: entry.playerId, delta: drop, dayLabel };
    }
  }

  return { rise, fall };
}

function buildHighestSingleMatchdayRecord(dailySnapshots: DailySnapshot[]): { playerId: string; points: number; dayLabel: string } | undefined {
  if (dailySnapshots.length === 0) return undefined;
  let best: { playerId: string; points: number; dayLabel: string } | undefined;
  let previousPointsByPlayer = new Map<string, number>();

  for (const snapshot of dailySnapshots) {
    const dayLabel = formatDayLabel(snapshot.dayKey);
    for (const entry of snapshot.entries) {
      const previousPoints = previousPointsByPlayer.get(entry.playerId) ?? 0;
      const gained = (entry.totalPoints ?? entry.points) - previousPoints;
      if (!best || gained > best.points) best = { playerId: entry.playerId, points: gained, dayLabel };
      previousPointsByPlayer.set(entry.playerId, entry.totalPoints ?? entry.points);
    }
  }

  return best;
}

function buildBestGroupStagePredictor(
  repository: PredictionLeagueRepositoryLike,
  confirmedMatches: ConfirmedMatchRow[],
  actualGroupStandings: ActualGroupStanding[] | undefined,
  playerNameById: Map<string, string>
): { playerId: string; points: number } | undefined {
  const groupMatches = confirmedMatches.filter((match) => match.stage === 'GROUP');
  if (groupMatches.length === 0) return undefined;

  return repository.getPlayers()
    .map((player) => ({
      playerId: player.id,
      points: calculatePlayerPoints(player.id, repository.getMatchPredictions(), toScoringResults(groupMatches), {
        groupPredictions: repository.getGroupPredictions(player.id),
        actualGroupStandings
      }).totalPoints
    }))
    .sort((left, right) =>
      right.points - left.points ||
      playerLabel(playerNameById, left.playerId).localeCompare(playerLabel(playerNameById, right.playerId), 'et')
    )[0];
}

function buildBestKnockoutPredictor(
  repository: PredictionLeagueRepositoryLike,
  confirmedMatches: ConfirmedMatchRow[],
  actualKnockoutResults: ActualKnockoutResults | undefined,
  playerNameById: Map<string, string>
): { playerId: string; points: number } | undefined {
  const knockoutMatches = confirmedMatches.filter((match) => match.stage !== 'GROUP');
  if (knockoutMatches.length === 0) return undefined;

  return repository.getPlayers()
    .map((player) => ({
      playerId: player.id,
      points: calculatePlayerPoints(player.id, repository.getMatchPredictions(), toScoringResults(knockoutMatches), {
        knockoutPrediction: repository.getKnockoutPredictions(player.id)[0],
        actualKnockoutResults,
        awardsPrediction: repository.getAwardsPredictions(player.id)[0]
      }).totalPoints
    }))
    .sort((left, right) =>
      right.points - left.points ||
      playerLabel(playerNameById, left.playerId).localeCompare(playerLabel(playerNameById, right.playerId), 'et')
    )[0];
}

function buildStreakMetricsByPlayer(
  repository: PredictionLeagueRepositoryLike,
  playerIds: string[],
  confirmedMatches: ConfirmedMatchRow[]
): Map<string, StreakMetrics> {
  const scoringResults = toScoringResults(confirmedMatches);
  const predictions = repository.getMatchPredictions();
  const streaks = new Map<string, StreakMetrics>();

  for (const playerId of playerIds) {
    const breakdown = calculatePlayerPoints(playerId, predictions, scoringResults).breakdown.sort((left, right) => left.matchId - right.matchId);
    const pointsSequence = breakdown.map((row) => row.points > 0);
    streaks.set(playerId, {
      currentCorrect: trailingRun(pointsSequence, true),
      currentMiss: trailingRun(pointsSequence, false),
      longestCorrect: longestRun(pointsSequence, true),
      longestMiss: longestRun(pointsSequence, false)
    });
  }

  return streaks;
}

function buildActualState(input: {
  teams: TeamRow[];
  allMatches: MatchCatalogRow[];
  confirmedMatches: ConfirmedMatchRow[];
  scorerFacts: ScorerFactRow[];
}): {
  actualGroupStandings?: ActualGroupStanding[];
  actualKnockoutResults?: ActualKnockoutResults;
  actualTopScorers?: ActualTopScorer[];
} {
  return {
    actualGroupStandings: buildActualGroupStandings(input.teams, input.allMatches, input.confirmedMatches),
    actualKnockoutResults: buildActualKnockoutResults(input.allMatches, input.confirmedMatches),
    actualTopScorers: buildActualTopScorers(input.scorerFacts)
  };
}

function buildActualGroupStandings(
  teams: TeamRow[],
  allMatches: MatchCatalogRow[],
  confirmedMatches: ConfirmedMatchRow[]
): ActualGroupStanding[] | undefined {
  const groupTeams = teams.filter((team) => team.groupId);
  if (groupTeams.length === 0) return undefined;

  const standings = new Map(groupTeams.map((team) => [team.id, {
    groupId: team.groupId ?? '',
    teamId: team.id,
    teamName: team.nameEt?.trim() || team.name.trim(),
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0
  }]));
  const groupTotals = countBy(allMatches.filter((match) => match.stage === 'GROUP' && match.groupId), (match) => match.groupId ?? '');
  const confirmedByGroup = countBy(confirmedMatches.filter((match) => match.stage === 'GROUP' && match.groupId), (match) => match.groupId ?? '');

  for (const match of confirmedMatches) {
    if (match.stage !== 'GROUP') continue;
    const home = match.homeTeamId ? standings.get(match.homeTeamId) : undefined;
    const away = match.awayTeamId ? standings.get(match.awayTeamId) : undefined;
    if (!home || !away) continue;
    applyResult(home, match.homeScore, match.awayScore);
    applyResult(away, match.awayScore, match.homeScore);
  }

  const finalizedGroups = [...groupTotals.keys()]
    .filter((groupId) => (confirmedByGroup.get(groupId) ?? 0) === (groupTotals.get(groupId) ?? 0))
    .sort();
  if (finalizedGroups.length === 0) return undefined;

  const sortedByGroup = new Map(finalizedGroups.map((groupId) => [groupId, [...standings.values()]
    .filter((row) => row.groupId === groupId)
    .sort((left, right) =>
      right.points - left.points ||
      goalDifference(right) - goalDifference(left) ||
      right.goalsFor - left.goalsFor ||
      left.teamName.localeCompare(right.teamName, 'et')
    )]));
  const advancingThirdPlaceTeamIds = finalizedGroups.length === 12
    ? new Set(
      [...sortedByGroup.entries()]
        .flatMap(([groupId, rows]) => {
          const third = rows[2];
          return third ? [{ ...third, groupId }] : [];
        })
        .sort((left, right) =>
          right.points - left.points ||
          goalDifference(right) - goalDifference(left) ||
          right.goalsFor - left.goalsFor ||
          left.groupId.localeCompare(right.groupId, 'et') ||
          left.teamName.localeCompare(right.teamName, 'et')
        )
        .slice(0, 8)
        .map((row) => row.teamId)
    )
    : new Set<string>();

  return finalizedGroups.flatMap((groupId) =>
    (sortedByGroup.get(groupId) ?? []).map((row, index) => ({
      group: groupId,
      team: row.teamName,
      rank: index + 1,
      qualified: index < 2 || advancingThirdPlaceTeamIds.has(row.teamId)
    }))
  );
}

function buildActualKnockoutResults(
  allMatches: MatchCatalogRow[],
  confirmedMatches: ConfirmedMatchRow[]
): ActualKnockoutResults | undefined {
  const totals = countBy(allMatches.filter((match) => isKnockoutStage(match.stage)), (match) => match.stage);
  const confirmedByStage = groupBy(confirmedMatches.filter((match) => isKnockoutStage(match.stage)), (match) => match.stage);
  const stageTeams: NonNullable<ActualKnockoutResults['stageTeams']> = {};
  const stageToNextRound: Record<'R32' | 'R16' | 'QF' | 'SF', 'R16' | 'QF' | 'SF' | 'Final'> = {
    R32: 'R16',
    R16: 'QF',
    QF: 'SF',
    SF: 'Final'
  };

  for (const stage of ['R32', 'R16', 'QF', 'SF'] as const) {
    const confirmedRows = confirmedByStage.get(stage) ?? [];
    if (confirmedRows.length === 0 || confirmedRows.length !== (totals.get(stage) ?? 0)) continue;
    const winners = confirmedRows.map(resolveWinner).filter((winner): winner is string => Boolean(winner));
    if (winners.length > 0) stageTeams[stageToNextRound[stage]] = winners;
  }

  const thirdPlaceRows = confirmedByStage.get('THIRD_PLACE') ?? [];
  const finalRows = confirmedByStage.get('FINAL') ?? [];
  const thirdPlaceWinner = thirdPlaceRows.length === (totals.get('THIRD_PLACE') ?? 0) ? resolveWinner(thirdPlaceRows[0]) : undefined;
  const champion = finalRows.length === (totals.get('FINAL') ?? 0) ? resolveWinner(finalRows[0]) : undefined;

  if (Object.keys(stageTeams).length === 0 && !thirdPlaceWinner && !champion) return undefined;
  return {
    stageTeams: Object.keys(stageTeams).length > 0 ? stageTeams : undefined,
    thirdPlaceWinner,
    champion
  };
}

function buildActualTopScorers(scorerFacts: ScorerFactRow[]): ActualTopScorer[] | undefined {
  const grouped = new Map<string, { playerName: string; team?: string; goals: number }>();

  for (const fact of scorerFacts) {
    if (fact.playerName === MANUAL_UNKNOWN_SCORER_NAME || fact.goals <= 0) continue;
    const identity = resolveScorerIdentity({
      playerName: fact.playerName,
      playerId: fact.playerId,
      providerPlayerId: fact.providerPlayerId
    });
    const key = `${identity.lookupKey}|${fact.teamId ?? ''}|${fact.teamCode ?? ''}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.goals += fact.goals;
      continue;
    }
    grouped.set(key, {
      playerName: identity.playerName,
      team: fact.teamCode ?? fact.teamId,
      goals: fact.goals
    });
  }

  const rows = [...grouped.values()];
  if (rows.length === 0) return undefined;
  const maxGoals = Math.max(...rows.map((row) => row.goals));
  return rows
    .filter((row) => row.goals === maxGoals)
    .map((row) => ({ name: row.playerName, team: row.team }));
}

function resolveWinner(match: ConfirmedMatchRow | undefined): string | undefined {
  if (!match) return undefined;
  if (match.homeScore > match.awayScore) return match.homeTeam;
  if (match.awayScore > match.homeScore) return match.awayTeam;
  if (match.penaltyWinnerTeamId) {
    if (match.penaltyWinnerTeamId === match.homeTeamId) return match.homeTeam;
    if (match.penaltyWinnerTeamId === match.awayTeamId) return match.awayTeam;
  }
  if (match.penaltyWinnerTeamCode) {
    if (match.penaltyWinnerTeamCode === match.homeTeamCode) return match.homeTeam;
    if (match.penaltyWinnerTeamCode === match.awayTeamCode) return match.awayTeam;
  }
  return undefined;
}

function toScoringResults(matches: ConfirmedMatchRow[]) {
  return matches.map((match) => ({
    matchId: match.matchId,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    isFinal: true
  }));
}

function toMatchCatalogRow(row: Record<string, unknown>): MatchCatalogRow {
  return {
    matchId: Number(row.id),
    stage: String(row.stage ?? ''),
    groupId: stringOrUndefined(row.group_id),
    kickoffAt: String(row.kickoff_at ?? ''),
    homeTeamId: stringOrUndefined(row.home_team_id),
    awayTeamId: stringOrUndefined(row.away_team_id),
    homeTeam: String(row.home_team ?? ''),
    awayTeam: String(row.away_team ?? ''),
    homeTeamCode: stringOrUndefined(row.home_team_code),
    awayTeamCode: stringOrUndefined(row.away_team_code)
  };
}

function createPlayerCard(input: {
  id: string;
  title: string;
  badge: string;
  tone: PredictionLeagueInsightCard['tone'];
  value: string;
  subject: string;
  detail: string;
}): PredictionLeagueInsightCard {
  return { ...input };
}

function createMetricCard(input: {
  id: string;
  title: string;
  badge: string;
  tone: PredictionLeagueInsightCard['tone'];
  value: string;
  subject: string;
  detail: string;
}): PredictionLeagueInsightCard {
  return { ...input };
}

function unavailableCard(
  id: string,
  title: string,
  badge: string,
  tone: PredictionLeagueInsightCard['tone'],
  detail: string
): PredictionLeagueInsightCard {
  return {
    id,
    title,
    badge,
    tone,
    value: '—',
    subject: PREDICTION_CARD_FALLBACK,
    detail,
    unavailable: true
  };
}

function playerLabel(playerNameById: Map<string, string>, playerId: string): string {
  return playerNameById.get(playerId) ?? playerId;
}

function sortPlayersByStreak(
  playerIds: string[],
  streaksByPlayer: Map<string, StreakMetrics>,
  key: keyof StreakMetrics,
  playerNameById: Map<string, string>
): string[] {
  return [...playerIds].sort((left, right) =>
    streakValue(streaksByPlayer, right, key) - streakValue(streaksByPlayer, left, key) ||
    playerLabel(playerNameById, left).localeCompare(playerLabel(playerNameById, right), 'et')
  );
}

function streakValue(streaksByPlayer: Map<string, StreakMetrics>, playerId: string, key: keyof StreakMetrics): number {
  return streaksByPlayer.get(playerId)?.[key] ?? 0;
}

function trailingRun(values: boolean[], expected: boolean): number {
  let count = 0;
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] !== expected) break;
    count += 1;
  }
  return count;
}

function longestRun(values: boolean[], expected: boolean): number {
  let best = 0;
  let current = 0;
  for (const value of values) {
    if (value === expected) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  return best;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatDecimal(value: number): string {
  return value.toLocaleString('et-EE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function ordinal(rank: number): string {
  return `${rank}.`;
}

function bonusPoints(entry: LeaderboardEntry): number {
  return (entry.groupBonusPoints ?? 0) + (entry.playoffBonusPoints ?? 0) + (entry.topScorerBonusPoints ?? 0);
}

function buildCanonicalEntries(players: Player[], persistedEntries: LeaderboardEntry[]): LeaderboardEntry[] {
  if (players.length === predictionRepository.getPlayers().length) {
    return buildCanonicalPublicLeaderboardEntries(persistedEntries);
  }

  const persistedByPlayerId = new Map(persistedEntries.map((entry) => [entry.playerId, entry]));
  const playerNameById = new Map(players.map((player) => [player.id, player.name]));
  const rows = players.map((player) => {
    const persisted = persistedByPlayerId.get(player.id);
    return {
      playerId: player.id,
      rank: 0,
      points: persisted?.points ?? 0,
      exactScores: persisted?.exactScores ?? 0,
      correctResults: persisted?.correctResults ?? 0,
      hitRate: persisted?.hitRate ?? 0,
      matchesScored: persisted?.matchesScored ?? 0,
      matchPoints: persisted?.matchPoints ?? persisted?.points ?? 0,
      groupBonusPoints: persisted?.groupBonusPoints ?? 0,
      playoffBonusPoints: persisted?.playoffBonusPoints ?? 0,
      topScorerBonusPoints: persisted?.topScorerBonusPoints ?? 0,
      totalPoints: persisted?.totalPoints ?? persisted?.points ?? 0,
      previousRank: persisted?.previousRank ?? persisted?.rank,
      lastUpdatedAt: persisted?.lastUpdatedAt ?? ''
    };
  });

  rows.sort((left, right) =>
    right.points - left.points ||
    right.exactScores - left.exactScores ||
    right.correctResults - left.correctResults ||
    right.hitRate - left.hitRate ||
    playerLabel(playerNameById, left.playerId).localeCompare(playerLabel(playerNameById, right.playerId), 'et')
  );

  let currentRank = 0;
  let previousKey = '';
  return rows.map((row, index) => {
    const key = `${row.points}|${row.exactScores}|${row.correctResults}|${row.hitRate}`;
    if (key !== previousKey) currentRank = index + 1;
    previousKey = key;
    return { ...row, rank: currentRank };
  });
}

function toTallinnDayKey(value: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Tallinn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '00';
  const day = parts.find((part) => part.type === 'day')?.value ?? '00';
  return `${year}-${month}-${day}`;
}

function formatDayLabel(dayKey: string): string {
  const [, month, day] = dayKey.split('-');
  return `${day}.${month}`;
}

function applyResult(row: {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}, goalsFor: number, goalsAgainst: number): void {
  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  if (goalsFor > goalsAgainst) {
    row.wins += 1;
    row.points += 3;
  } else if (goalsFor === goalsAgainst) {
    row.draws += 1;
    row.points += 1;
  } else {
    row.losses += 1;
  }
}

function goalDifference(row: { goalsFor: number; goalsAgainst: number }): number {
  return row.goalsFor - row.goalsAgainst;
}

function isKnockoutStage(stage: string): stage is 'R32' | 'R16' | 'QF' | 'SF' | 'THIRD_PLACE' | 'FINAL' {
  return ['R32', 'R16', 'QF', 'SF', 'THIRD_PLACE', 'FINAL'].includes(stage);
}

function countBy<T>(rows: T[], key: (row: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const groupKey = key(row);
    counts.set(groupKey, (counts.get(groupKey) ?? 0) + 1);
  }
  return counts;
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const groupKey = key(row);
    grouped.set(groupKey, [...(grouped.get(groupKey) ?? []), row]);
  }
  return grouped;
}

function stringOrUndefined(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return String(value);
}
