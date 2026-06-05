# Sprint 17 - Free Provider Chain Foundation

- [x] Inspect current provider config, factory, consensus, agent, and docs.
- [x] Add provider-specific config for API-Football and football-data.org.
- [x] Add API-Football adapter skeleton with mocked-response parser tests.
- [x] Add football-data.org adapter skeleton with mocked-response parser tests.
- [x] Add provider chain that keeps mock default and preserves Sportmonks.
- [x] Integrate provider-chain observations into result-agent consensus.
- [x] Add request-budget behavior for verifier providers.
- [x] Update provider strategy docs, results-agent docs, README, and `.env.example`.
- [x] Run `npm run build`.
- [x] Run targeted provider/consensus/agent tests.
- [ ] Commit, push, and verify `HEAD == origin/main`.

## Review

- Added mock-default provider chain support for API-Football, football-data.org, and optional Sportmonks.
- Added mocked-network adapter tests and result-agent consensus tests for multi-provider agreement/disagreement.
- `npm run build` passed.
- Targeted Vitest command passed: `npx vitest run src/test/resultProviderFactory.test.ts src/test/apiFootballResultProvider.test.ts src/test/footballDataResultProvider.test.ts src/test/providerChainResultProvider.test.ts src/test/resultConsensus.test.ts src/test/resultAgent.test.ts`.
