# Sprint 12 - Official Scoring Rules

- [x] Audit current Sprint 7 points engine, leaderboard rebuild, prediction repository, and seed shapes.
- [x] Replace temporary `3/1/0` match scoring with official `6/4/2/0` scoring.
- [x] Add structured scoring breakdown fields.
- [x] Add group bonus calculator.
- [x] Add play-off progression, champion, and third-place winner bonus calculator.
- [x] Add top scorer bonus calculator with shared-winner support.
- [x] Integrate official scoring into leaderboard rebuild with safe warnings for missing actual bonus data.
- [x] Update scoring, data model, and result-agent documentation.
- [x] Add targeted scoring and rebuild tests.
- [x] Run targeted validation.
- [x] Commit, push, and verify `HEAD == origin/main`.

## Review

- Targeted tests passed: `npx vitest run src/test/pointsEngine.test.ts src/test/resultAgent.test.ts src/test/predictionRepository.test.ts`.
- Build passed: `npm run build`.
- Prediction seed validation and tournament data validation were not run because seed schemas/data and tournament data files were not changed.
- Git publication completed after verification.
