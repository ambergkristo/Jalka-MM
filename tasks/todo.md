# Sprint 19 - Public Data Wiring

- [x] Audit current public API and frontend data wiring after Sprint 18.
- [x] Add route-specific public API endpoints for results and tournament data.
- [x] Extend public dashboard payload with backend upcoming matches.
- [x] Wire results page to backend upcoming matches when API data is available.
- [x] Preserve confirmed-only behavior for latest results and provisional statuses.
- [x] Update public simulation/frontend verification documentation.
- [x] Run targeted tests and `npm run build`.
- [x] Run `npm run simulate:reset` and `npm run simulate:matchday1`.
- [x] Commit, push, and verify `HEAD == origin/main`.

## Review

- `npm run build` passed.
- Targeted Vitest tests passed for result consensus, result agent, and public dashboard pages/data.
- Node SQLite simulation test passed: `node --test dist/test-db/matchday-simulation-node-test.js`.
- `npm run simulate:reset` passed.
- `npm run simulate:matchday1` passed with 3 confirmed results, 24 leaderboard rows, and 7 top scorers.
