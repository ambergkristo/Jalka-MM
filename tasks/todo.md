# Sprint 7 - Points Engine Integration

- [x] Read data model, masterplan, sprint, results-agent docs, and existing scoring utilities.
- [x] Add match prediction seed data.
- [x] Add MVP points engine.
- [x] Implement exact-score, outcome, draw, incorrect-result scoring.
- [x] Calculate player totals, exact scores, correct results, hit rate, and matches scored.
- [x] Rebuild leaderboard from players, match predictions, and finalized results.
- [x] Integrate result-agent leaderboard rebuild with the real points engine.
- [x] Add `GET /api/leaderboard`.
- [x] Document MVP scoring rules and deferred scoring.
- [x] Add points engine and rebuild tests.
- [x] Run full verification commands.

## Review

- Sprint scope is MVP match-prediction scoring only; no real football API or Excel import was added.
- Bonus scoring for group rank, knockout progression, champion, top scorer, and best player remains deferred.
- Rebuilt leaderboard entries are currently exposed in memory after mock result-agent runs; database persistence remains future work.
- Verification passed: `npm test`, `npm run build`, `npm run validate:tournament-data`, `npm run audit:tournament-data`, and built-server smoke checks for `/api/leaderboard` before and after `/api/results-agent/run`.
- Tournament data audit still reports existing `partial_official` status with medium risk because knockout fixture dates and slots remain unresolved.
