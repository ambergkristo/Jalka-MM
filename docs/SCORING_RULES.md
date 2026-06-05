# Scoring Rules

Sprint 7 implements the first real MVP points engine for match predictions.

## Implemented MVP Match Scoring

Only finalized match results are scored.

For each player match prediction:

- Exact score: 3 points
- Correct result outcome: 1 point
- Incorrect result: 0 points

Outcome means:

- Home win
- Draw
- Away win

Exact score also counts as a correct result for `correctResults` and hit-rate metrics.

## Leaderboard Metrics

The points engine calculates:

- `points`
- `exactScores`
- `correctResults`
- `hitRate`
- `matchesScored`

Leaderboard ordering:

1. Points, descending
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

## Deferred Scoring

These rules are intentionally not implemented yet:

- Group rank bonus
- Knockout progression bonus
- Champion bonus
- Top scorer bonus
- Best player bonus
- Penalty shootout winner scoring
- Correct team-slot scoring for unresolved knockout fixtures

Future Excel-derived bonus prediction seed files should be connected to the points engine after final scoring rules are agreed.
