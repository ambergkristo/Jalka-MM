# Scoring Rules

This document describes the official MM 2026 prediction league scoring model implemented in `src/domain/pointsEngine.ts`.

Sprint 12 replaces the temporary Sprint 7 MVP `3/1/0` model. The app now uses official `6/4/2/0` match scoring plus bonus calculators for group standings, play-off progression, champion, and top scorer.

## Match Scoring

Only finalized match results are scored.

Group-stage and play-off match predictions use the same match-score rules:

- Exact score: 6 points
- Correct winner/draw and correct goal difference: 4 points
- Correct winner/draw only: 2 points
- Incorrect result: 0 points

Definitions:

- Exact score means predicted home goals and away goals both match the actual result.
- Correct outcome means home win, draw, or away win.
- Correct goal difference means `predictedHomeGoals - predictedAwayGoals` equals `actualHomeGoals - actualAwayGoals`.

Examples:

- Predicted `2-1`, actual `2-1`: 6 points.
- Predicted `2-0`, actual `3-1`: 4 points.
- Predicted `2-0`, actual `1-0`: 2 points.
- Predicted `1-1`, actual `0-0`: 4 points.
- Predicted `1-1`, actual `1-0`: 0 points.

## Penalties

Play-off match points use the normal-time plus extra-time score.

Penalty shootout goals are not included in match-score points. A predicted draw after extra time can therefore score 6 or 4 points if the actual match is also drawn after extra time. Penalty winner is used only for advancement logic and future bracket resolution.

## Group Bonus

After official group standings are available:

- Correct group winner: 10 points per team.
- Correct group second place: 5 points per team.
- Correct group qualifier: 3 points per correctly qualifying team.

Qualifier points are additive. A player can receive position points and qualifier points for the same team.

Qualifiers currently support:

- group winner
- group second place
- third-place team if `qualified: true` is available in actual standings

The function accepts first, second, and third predictions now and is structured so future best-third-place qualifier data can be added without changing page code.

## Play-off Bonus

Bonuses are awarded by team identity, not by slot.

- Correct R16 team: 15 points.
- Correct quarter-final team: 20 points.
- Correct semi-final team: 25 points.
- Correct finalist: 30 points.
- Correct 3rd-place match winner: 40 points.
- Correct champion: 100 points.

The current seed model stores predicted stage teams in `knockoutPredictions.json` and predicted champion in `awardsPredictions.json`. The engine also supports an optional `thirdPlaceWinner` field on knockout predictions; existing imported seeds can omit it safely until the Excel mapping exposes that value.

## Top Scorer Bonus

- Correct top scorer: 50 points.

If multiple players share the tournament top scorer title, a prediction for any shared top scorer earns 50 points. The 50 points are not split between predictors.

## Leaderboard Metrics

The points engine calculates:

- `matchPoints`
- `groupBonusPoints`
- `playoffBonusPoints`
- `topScorerBonusPoints`
- `totalPoints`
- `exactScores`
- `correctResults`
- `hitRate`
- `matchesScored`
- warnings for incomplete actual data

The public leaderboard still exposes:

- `points`
- `exactScores`
- `correctResults`
- `hitRate`

Leaderboard ordering remains deterministic:

1. Total points, descending
2. Exact scores, descending
3. Correct results, descending
4. Player id, ascending

## Current Data Flow

```text
Prediction seed files
-> PredictionRepository
-> PointsEngine
-> LeaderboardRebuild
-> ResultAgent summary / in-memory leaderboard API
```

The current leaderboard API can return either seed entries or in-memory recalculated entries after the mock result agent runs. Database persistence of rebuilt leaderboard rows is deferred.

## Implemented Now

- Official `6/4/2/0` match scoring.
- Group bonus calculator.
- Play-off progression and champion bonus calculator.
- Top scorer bonus calculator with shared-winner support.
- Safe warnings when actual group standings, knockout results, or top scorer data are unavailable.
- Server-side leaderboard rebuild using the official points engine where data exists.

## Deferred

- Best Player scoring is deferred because the public seed/domain model does not yet safely expose a best-player prediction field.
- Final database persistence of detailed scoring breakdowns is deferred.
- Final live actual group standings, actual knockout stage-team data, and official top scorer feed integration are deferred until real tournament/result data is connected.
