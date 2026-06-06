# Sprint 19.2 - Public Tournament State Sync

- [x] Audit tournament page, public snapshot, and mock knockout data leakage.
- [x] Add shared public playoff bracket builder with placeholder-only default.
- [x] Expose playoff bracket through public tournament/dashboard state.
- [x] Wire `/tournament` to public bracket state and neutral pre-tournament fallback.
- [x] Keep group standings, group leaders, top scorers, and bracket under the same public snapshot.
- [x] Add tests for placeholder bracket gating and simulation behavior.
- [x] Run targeted tests and `npm run build`.
- [x] Run `npm run simulate:reset` and `npm run simulate:matchday1`.
- [x] Commit, push, and verify `HEAD == origin/main`.

## Review

- `npm run build` passed.
- Targeted Vitest tests passed: true bracket and public dashboard pages.
- Targeted Node SQLite tests passed: matchday simulation and result persistence.
- `npm run simulate:reset` passed and cleared simulation state.
- `npm run simulate:matchday1` passed with 3 confirmed results, 24 leaderboard rows, and 7 top scorers.
- Play-off remains placeholder-only before group qualifiers are resolved.
