# Sprint 15 - Result Agent Production Safety

- [x] Audit result-agent endpoint, provider config, factory, Sportmonks adapter, and provider match map.
- [x] Add live write protection for `POST /api/results-agent/run`.
- [x] Require `x-results-agent-secret` only for live writes.
- [x] Add dry-run behavior that fetches provider updates without DB writes.
- [x] Add provider match map live validation.
- [x] Add provider match map validation script.
- [x] Keep mock mode simple for local development.
- [x] Document Sportmonks fixture mapping workflow.
- [x] Add targeted tests for secret guard, dry-run, provider map validation, and factory behavior.
- [x] Run targeted validation.
- [x] Commit, push, and verify `HEAD == origin/main`.

## Review

- Build passed: `npm run build`.
- Targeted tests passed: `npx vitest run src/test/resultAgentSecurity.test.ts src/test/resultAgent.test.ts src/test/resultProviderFactory.test.ts src/test/providerMatchMap.test.ts src/test/sportmonksResultProvider.test.ts src/test/mockResultProvider.test.ts`.
- Provider match map validation passed in mock-default mode: `npm run validate:provider-match-map`.
- Persistence node test passed: `node --test dist/test-db/result-persistence-node-test.js`.
- API smoke checks passed for `/api/results-agent/status` and `POST /api/results-agent/run?dryRun=true`.
- Git publication completed after verification.
