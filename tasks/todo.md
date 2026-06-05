# Sprint 13 - Result And Leaderboard Persistence

- [x] Audit existing DB adapter, result-agent repository contract, leaderboard rebuild, and DB tests.
- [x] Add idempotent result persistence schema upgrades.
- [x] Add database-backed result repository for tracked matches, match result upserts, finalized results, and recalculation metadata.
- [x] Add leaderboard repository for persisted leaderboard rows and rebuild metadata.
- [x] Integrate database repository into result-agent runtime.
- [x] Persist rebuilt leaderboard entries after finalized result changes.
- [x] Update `/api/leaderboard` to prefer persisted rows and fallback to seed rows.
- [x] Add deterministic DB/repository/result-agent persistence tests.
- [x] Update documentation.
- [x] Run targeted validation.
- [x] Commit, push, and verify `HEAD == origin/main`.

## Review

- Build passed: `npm run build`.
- Targeted Vitest passed: `npx vitest run src/test/resultAgent.test.ts src/test/pointsEngine.test.ts src/test/predictionRepository.test.ts`.
- DB node tests passed: `node --test dist/test-db/result-persistence-node-test.js` and `node --test dist/test-db/db-node-test.js`.
- Optional smoke checks passed for `/leaderboard`, `/tournament`, and `/api/leaderboard`.
- Git publication completed after verification.
