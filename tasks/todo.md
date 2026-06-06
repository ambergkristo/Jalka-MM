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
