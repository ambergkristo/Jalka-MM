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
  publicStatus:
    | "SCHEDULED"
    | "LIVE"
    | "CONFIRMING"
    | "CONFIRMED_FINAL"
    | "NEEDS_REVIEW";
  homeScore?: number;
  awayScore?: number;
  provisionalHomeScore?: number;
  provisionalAwayScore?: number;
  provisionalStatus?: MatchStatus;
  confirmedHomeScore?: number;
  confirmedAwayScore?: number;
  confirmedAt?: string;
  confirmationSource?: string;
  confirmationConfidence?: "provider-repeat" | "provider-agreement" | "manual";
  needsReviewReason?: string;
  minute?: number;
  providerFixtureId?: string;
  isFinal: boolean;
  lastCheckedAt: string;
  lastProviderCheckAt?: string;
  nextCheckAt?: string;
  nextConfirmationCheckAt?: string;
  providerResults?: ProviderResultObservation[];
  pointsRecalculatedAt?: string;
  providerUpdatedAt?: string;
  rawProviderStatus?: string;
  warning?: string;
  errorMessage?: string;
}

interface ProviderResultObservation {
  provider: string;
  matchId: number;
  status: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  minute?: number;
  isFinal: boolean;
  observedAt: string;
  providerFixtureId?: string;
  rawProviderStatus?: string;
  confidence?: "low" | "medium" | "high" | "confirmed";
  providerUpdatedAt?: string;
  warnings?: string[];
}

interface LeaderboardEntry {
  playerId: string;
  rank: number;
  points: number;
  exactScores: number;
  correctResults: number;
  hitRate: number;
  matchesScored?: number;
  matchPoints?: number;
  groupBonusPoints?: number;
  playoffBonusPoints?: number;
  topScorerBonusPoints?: number;
  totalPoints?: number;
  lastUpdatedAt: string;
  previousRank?: number;
}

interface PlayerPointsResult {
  playerId: string;
  matchPoints: number;
  groupBonusPoints: number;
  playoffBonusPoints: number;
  topScorerBonusPoints: number;
  totalPoints: number;
  exactScores: number;
  correctResults: number;
  hitRate: number;
  matchesScored: number;
  warnings: string[];
}

interface ActualGroupStanding {
  group: string;
  team: string;
  rank: number;
  qualified?: boolean;
}

interface ActualKnockoutResults {
  stageTeams?: Partial<Record<"R32" | "R16" | "QF" | "SF" | "Final", string[]>>;
  thirdPlaceWinner?: string;
  champion?: string;
}

interface ActualTopScorer {
  name: string;
  team?: string;
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
- `src/domain/pointsEngine.ts` implements official `6/4/2/0` match scoring plus group, play-off, champion, and top scorer bonus calculators.
- `PlayerPointsResult` is an internal scoring breakdown used before saving or exposing compact `LeaderboardEntry` rows.
- Actual bonus data is represented separately from predictions so the result agent can add official group/play-off/top-scorer data later without changing prediction seed files.
- `ResultUpdate` records support result-agent observability and catch-up behavior. Public final scores require `publicStatus="CONFIRMED_FINAL"` and `isFinal=true`; provider-final scores can be stored provisionally without affecting the leaderboard.
- `LeaderboardEntry` is a saved runtime projection, not a client-side calculation. Sprint 13 persists rebuilt leaderboard rows with scoring breakdown fields when available.
- `GroupStanding` and `TopScorerStanding` are saved runtime projections for the Tournament Center.
