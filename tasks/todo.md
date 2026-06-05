# Sprint 16 - Confirmed Result Policy

- [x] Inspect result-agent, provider, persistence, API, and docs.
- [x] Add provisional/confirmed result state types.
- [x] Add provider observation and consensus service.
- [x] Persist provisional/confirmed result fields and enough observation metadata for restart-safe delayed confirmation.
- [x] Rebuild leaderboard only after confirmed final result changes.
- [x] Add public result mapper for confirmed-only score exposure.
- [x] Add targeted consensus, agent, persistence, and public mapper tests.
- [x] Update result-agent and data-model documentation.
- [x] Run `npm run build`.
- [x] Run targeted tests.
- [x] Commit, push, and verify `HEAD == origin/main`.

## Review

- Build passed: `npm run build`.
- Targeted Vitest passed: `npx vitest run src/test/resultConsensus.test.ts src/test/resultAgent.test.ts src/test/matchScheduler.test.ts src/test/resultProviderFactory.test.ts src/test/mockResultProvider.test.ts src/test/sportmonksResultProvider.test.ts`.
- Persistence node test passed: `node --test dist/test-db/result-persistence-node-test.js`.
- Git publication completed after verification.
