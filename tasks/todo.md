# Sprint 19 Bugfixes - Public Scoring State

- [x] Audit public leaderboard seed fallback, match kickoff labels, and top scorer prediction mapping.
- [x] Zero public leaderboard before persisted confirmed-result scoring exists.
- [x] Keep persisted recalculated leaderboard after confirmed simulation.
- [x] Restore zero public leaderboard after `simulate:reset`.
- [x] Add date + kickoff time to scheduled match cards.
- [x] Resolve known predicted top scorer teams from scorer-name lookup.
- [x] Run targeted tests and `npm run build`.
- [x] Run `npm run simulate:reset` and `npm run simulate:matchday1`.
- [x] Commit, push, and verify `HEAD == origin/main`.

## Review

- `npm run build` passed.
- Targeted Vitest tests passed: public dashboard data/pages, prediction view models, result consensus, result agent.
- Targeted Node SQLite tests passed: result persistence and matchday simulation.
- `npm run simulate:reset` passed and cleared simulation state.
- `npm run simulate:matchday1` passed with 3 confirmed results, 24 leaderboard rows, and 7 top scorers.
