# Sprint 18 - Matchday 1 End-to-End Simulation

- [x] Inspect result-agent, persistence, public API, frontend data paths, and tournament fixtures.
- [x] Add simulation fixtures and controlled simulation provider.
- [x] Add reset and matchday simulation CLI scripts.
- [x] Add public dashboard snapshot API for confirmed results, group standings, top scorers, and tournament summary.
- [x] Wire landing/results/leaderboard/tournament pages to persisted public API data with safe fallbacks.
- [x] Add persistent group standings and top scorer table migration coverage.
- [x] Add targeted simulation tests using real SQLite persistence.
- [x] Run targeted tests and `npm run build`.
- [x] Run `npm run simulate:reset` and `npm run simulate:matchday1`.
- [ ] Commit, push, and verify `HEAD == origin/main`.

## Review

- `npm run build` passed.
- Targeted Vitest tests passed for result consensus, result agent, and public dashboard pages/data.
- Node SQLite simulation test passed: `node --test dist/test-db/matchday-simulation-node-test.js`.
- `npm run simulate:reset` passed.
- `npm run simulate:matchday1` passed with 3 provisional observations, 3 confirmed results, 24 leaderboard rows, and 7 top scorers.
- `npm run simulate:matchday1:disagreement` passed with 3 `NEEDS_REVIEW` rows and no leaderboard rebuild.
