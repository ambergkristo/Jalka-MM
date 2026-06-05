# Sprint 14 - Sportmonks Result Provider Adapter

- [x] Confirm documented provider recommendation.
- [x] Add Sportmonks result provider adapter.
- [x] Add provider match map lookup for fixture ids.
- [x] Keep mock provider as the safe default.
- [x] Wire provider factory to instantiate Sportmonks only when selected.
- [x] Preserve stubs for non-selected real providers.
- [x] Add mocked-network tests for Sportmonks status, score, minute, and warning normalization.
- [x] Update env example and documentation.
- [x] Run targeted validation.
- [x] Commit, push, and verify `HEAD == origin/main`.

## Review

- Build passed: `npm run build`.
- Targeted provider tests passed: `npx vitest run src/test/resultProviderFactory.test.ts src/test/sportmonksResultProvider.test.ts src/test/providerMatchMap.test.ts src/test/mockResultProvider.test.ts src/test/resultAgent.test.ts`.
- Persistence node test passed after the DB repository TBC-kickoff guard: `node --test dist/test-db/result-persistence-node-test.js`.
- Optional smoke check passed for `/api/results-agent/status` in mock mode.
- Git publication completed after verification.
