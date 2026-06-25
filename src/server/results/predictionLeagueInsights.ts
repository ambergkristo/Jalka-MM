import type { QueryableDatabase } from '../databaseAdapter.js';
import type { LeaderboardEntry, Player } from '../../domain/predictionRepository.js';
import { predictionRepository } from '../../domain/predictionRepository.js';
import { buildCanonicalPublicLeaderboardEntries } from '../../domain/publicLeaderboard.js';
import type { PredictionLeagueInsightCard, PredictionLeagueInsights } from '../../domain/predictionLeagueInsights.js';

interface PredictionLeagueRepositoryLike {
  getPlayers(): Player[];
}

const NO_MATCHES_TEXT = 'Kinnitatud mänge veel ei ole';

export async function getPredictionLeagueInsights(
  _db: QueryableDatabase,
  leaderboardEntries: LeaderboardEntry[],
  _now = new Date()
): Promise<PredictionLeagueInsights> {
  return buildPredictionLeagueInsights({ leaderboardEntries });
}

export function buildPredictionLeagueInsights(input: {
  leaderboardEntries: LeaderboardEntry[];
  repository?: PredictionLeagueRepositoryLike;
}): PredictionLeagueInsights {
  const repository = input.repository ?? predictionRepository;
  const players = repository.getPlayers();
  const playerNameById = new Map(players.map((player) => [player.id, player.name]));
  const currentEntries = buildCanonicalEntries(players, input.leaderboardEntries);
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
  const totalExactScores = currentEntries.reduce((sum, entry) => sum + entry.exactScores, 0);

  return {
    statistics: {
      eyebrow: 'Ennustusliiga',
      title: 'Ennustusliiga statistika',
      cards: [
        createMetricCard({
          id: 'player-count',
          title: 'Mängijate arv',
          badge: 'Nr',
          tone: 'blue',
          value: String(players.length),
          subject: 'Aktiivne edetabel',
          detail: 'kanonilise edetabeli põhjal'
        }),
        createMetricCard({
          id: 'average-points',
          title: 'Keskmine punktisumma',
          badge: 'Av',
          tone: 'blue',
          value: formatDecimal(currentEntries.reduce((sum, entry) => sum + entry.points, 0) / Math.max(players.length, 1)),
          subject: `${players.length} mängijat`,
          detail: 'kanonilise edetabeli põhjal'
        }),
        createMetricCard({
          id: 'total-exact-scores',
          title: 'Kokku täpseid skoore',
          badge: '6',
          tone: 'purple',
          value: String(totalExactScores),
          subject: `${players.length} mängijat`,
          detail: 'kanonilise edetabeli põhjal'
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
            title: 'Liider',
            badge: '1',
            tone: 'gold',
            value: `${currentLeader.points} p`,
            subject: playerLabel(playerNameById, currentLeader.playerId),
            detail: `${ordinal(currentLeader.rank)} koht`
          })
          : unavailableCard('current-leader', 'Liider', '1', 'gold', NO_MATCHES_TEXT),
        currentLeader
          ? createPlayerCard({
            id: 'highest-score',
            title: 'Kõige rohkem punkte',
            badge: 'Pt',
            tone: 'gold',
            value: `${currentLeader.points} p`,
            subject: playerLabel(playerNameById, currentLeader.playerId),
            detail: 'kanonilise edetabeli põhjal'
          })
          : unavailableCard('highest-score', 'Kõige rohkem punkte', 'Pt', 'gold', NO_MATCHES_TEXT),
        rankedByExacts[0]
          ? createPlayerCard({
            id: 'most-exact-scores',
            title: 'Kõige rohkem täpseid skoore',
            badge: '6',
            tone: 'purple',
            value: String(rankedByExacts[0].exactScores),
            subject: playerLabel(playerNameById, rankedByExacts[0].playerId),
            detail: 'kanonilise edetabeli põhjal'
          })
          : unavailableCard('most-exact-scores', 'Kõige rohkem täpseid skoore', '6', 'purple', NO_MATCHES_TEXT),
        rankedByHitRate[0]
          ? createPlayerCard({
            id: 'highest-hit-rate',
            title: 'Parim tabavus',
            badge: '%',
            tone: 'purple',
            value: formatPercent(rankedByHitRate[0].hitRate),
            subject: playerLabel(playerNameById, rankedByHitRate[0].playerId),
            detail: `${rankedByHitRate[0].matchesScored ?? 0} hinnatud mängu`
          })
          : unavailableCard('highest-hit-rate', 'Parim tabavus', '%', 'purple', NO_MATCHES_TEXT)
      ]
    }
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
    subject: 'Andmed puuduvad',
    detail,
    unavailable: true
  };
}

function playerLabel(playerNameById: Map<string, string>, playerId: string): string {
  return playerNameById.get(playerId) ?? playerId;
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
