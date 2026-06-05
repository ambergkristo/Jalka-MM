# Planned Data Model

This document describes the planned TypeScript-style data model for the public read-only tracker. It is an architecture target, not an implementation change for Sprint 0.

## Locked Decision

Leaderboard is rebuilt after result updates and saved to the database. Frontend reads saved leaderboard entries only.

The frontend may sort or filter already-returned rows for presentation, but official rank and points come from saved `LeaderboardEntry` records.

## Types

```ts
type MatchStage =
  | "GROUP"
  | "R32"
  | "R16"
  | "QF"
  | "SF"
  | "THIRD_PLACE"
  | "FINAL";

type MatchStatus =
  | "SCHEDULED"
  | "LIVE"
  | "HALF_TIME"
  | "FULL_TIME"
  | "EXTRA_TIME"
  | "PENALTIES"
  | "POSTPONED"
  | "SUSPENDED"
  | "CANCELLED";

interface Player {
  id: string;
  name: string;
  location?: string;
  avatarUrl?: string;
  createdAt: string;
}

interface Match {
  id: number;
  stage: MatchStage;
  group?: string;
  kickoffUtc: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  status: MatchStatus;
  isFinal: boolean;
  updatedAt?: string;
}

interface PlayerMatchPrediction {
  playerId: string;
  matchId: number;
  predictedHomeTeam?: string;
  predictedAwayTeam?: string;
  homeScore: number;
  awayScore: number;
  predictedWinner?: string;
  penaltyWinner?: string;
}

interface PlayerKnockoutPrediction {
  playerId: string;
  roundOf32TeamIds: string[];
  roundOf16TeamIds: string[];
  quarterFinalTeamIds: string[];
  semiFinalTeamIds: string[];
  finalistTeamIds: string[];
  thirdPlaceWinnerTeamId?: string;
  championTeamId: string;
}

interface GroupPrediction {
  playerId: string;
  group: string;
  winnerTeamId: string;
  runnerUpTeamId: string;
  thirdPlaceTeamId?: string;
  advancingTeamIds: string[];
}

interface AwardsPrediction {
  playerId: string;
  championTeamId: string;
  topScorerName: string;
  topScorerTeamId?: string;
}

interface ResultUpdate {
  id: string;
  matchId: number;
  source: string;
  status: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  isFinal: boolean;
  lastCheckedAt: string;
  nextCheckAt?: string;
  pointsRecalculatedAt?: string;
  rawProviderStatus?: string;
  errorMessage?: string;
}

interface LeaderboardEntry {
  playerId: string;
  rank: number;
  points: number;
  exactScores: number;
  correctResults: number;
  hitRate: number;
  lastUpdatedAt: string;
  previousRank?: number;
}

interface GroupStanding {
  group: string;
  teamId: string;
  rank: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  updatedAt: string;
}

interface TopScorerStanding {
  rank: number;
  playerName: string;
  teamId?: string;
  goals: number;
  assists?: number;
  minutesPlayed?: number;
  updatedAt: string;
}
```

## Notes

- `Player` records are public league participant records imported from the finalized prediction data.
- `Match` records store tournament schedule, live status, and final scores.
- `PlayerMatchPrediction`, `PlayerKnockoutPrediction`, `GroupPrediction`, and `AwardsPrediction` are imported from JSON/seed data generated from Excel.
- Sprint 7 stores MVP match prediction seed data in `src/data/predictions/matchPredictions.json`.
- `ResultUpdate` records support result-agent observability and catch-up behavior.
- `LeaderboardEntry` is a saved runtime projection, not a client-side calculation.
- `GroupStanding` and `TopScorerStanding` are saved runtime projections for the Tournament Center.
