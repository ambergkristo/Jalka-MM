# Sprint 21.2 - Manual Result Correction Fallback

- [x] Add manual confirmed result service.
- [x] Persist manual confirmations/corrections through `match_results`.
- [x] Rebuild and persist leaderboard after manual confirmation or correction.
- [x] Add manual correction audit trail.
- [x] Add trusted CLI command `npm run results:confirm`.
- [x] Add protected API endpoint `POST /api/results-agent/manual-confirm`.
- [x] Require `x-results-agent-secret` for manual API confirmation.
- [x] Handle same-score repeats idempotently.
- [x] Clear `NEEDS_REVIEW` on manual confirmation.
- [x] Add targeted persistence/security tests.
- [x] Document operational workflow.
- [x] Run build and targeted validation.

## Remaining Release Blockers

- Final Excel with all 50+ players must be imported and validated.
- Production Render env must be configured with `APP_ENV=production`, Postgres, `DATABASE_URL`, and secrets.
- Real provider credentials must be configured server-side only.
- Provider fixture mapping must be verified and `npm run validate:provider-match-map` must pass.
- Provider dry-run must pass against real accounts before live writes.

## Before Knockouts

- Implement qualifier resolver / group-to-playoff progression.
- Implement best-third-place logic and final group tie-break handling.
- Confirm knockout fixture/slot mapping.

## Operational Follow-Ups

- Assign production owner/runbook for manual result correction.
- Final mobile smoke pass on `/`, `/results`, `/leaderboard`, `/player/kristo-amberg`, `/tournament`, and `/not-found`.
- Verify free provider request budgets and fallback plan before tournament start.

## Review

- `npm run build` passed.
- `npx vitest run src/test/resultAgentSecurity.test.ts` passed.
- `node --test dist/test-db/manual-result-correction-node-test.js` passed.
- `npm run simulate:reset` passed.
- `npm run results:confirm -- --matchId=1 --homeScore=2 --awayScore=1 --decidedAfter=FT --source=manual --confirmedBy=codex-test --notes=CLI-smoke-test` passed.
- Final `npm run simulate:reset` passed and returned the app to pre-result mode.

# Sprint 23 - API-Football Discovery

- [x] Add a minimal `npm run api-football:discover` command.
- [x] Read `API_FOOTBALL_API_KEY` and fail clearly when it is missing.
- [x] Use `league=1` and `season=2026` for discovery calls.
- [x] Write a candidate map under `imports/` without touching the production provider map.
- [x] Add a focused test for the matching helper and missing-key guard.
- [x] Document the discovery workflow and required env vars.
- [x] Run the discovery command with the current environment and verify the missing-key failure path.
- [ ] Run the discovery command with a real API key if one is available.
- [ ] Verify commit hash and `origin/main` alignment after push.

## Review

- `npm run build` passed.
- `npx vitest run src/test/discoverApiFootball.test.ts` passed.
- `npm run api-football:discover` failed clearly with the expected missing-key message because `API_FOOTBALL_API_KEY` is not set in the current environment.
