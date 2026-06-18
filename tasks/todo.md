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

# Sprint 24 - Open WorldCup Dry-Run Provider Chain

- [x] Add high-confidence-only open-worldcup fixture lookup to the provider path.
- [x] Make result-agent dry-run run consensus without DB writes or leaderboard rebuilds.
- [x] Add `npm run open-worldcup:dry-run`.
- [x] Document the dry-run flow, high-confidence-only policy, and known knockout gap.
- [x] Add targeted tests for open-worldcup mapping and dry-run behavior.
- [x] Run build and targeted validation.

## Review

- `npm run build` passed.
- `npx vitest run src/test/openWorldCupResultProvider.test.ts src/test/resultAgent.test.ts src/test/resultProviderFactory.test.ts` passed.
- `npm run open-worldcup:dry-run -- --now=2026-06-11T19:30:00Z` reached the provider list endpoint, produced one observation, skipped no mappings in that run, and reported `dbWrites: 0`.

# Sprint 25 - Open WorldCup Live-Write Operations

- [x] Verify `/api/results-agent/run` rejects missing/wrong secret in live mode.
- [x] Expose a safe operational `/api/results-agent/status` summary for phone checks.
- [x] Document Render live env, cron-job.org, and rollback steps.
- [x] Prove open-worldcup live mode remains high-confidence-only and non-final guarded.
- [x] Add or update targeted tests for live-write security and status output.
- [x] Run build, targeted tests, and a live-mode safety check.

## Review

- `npm run build` passed.
- `npx vitest run src/test/resultAgentSecurity.test.ts src/test/openWorldCupResultProvider.test.ts src/test/resultAgent.test.ts` passed.
- `npm run open-worldcup:dry-run -- --now=2026-06-11T19:30:00Z` still worked and reported `dbWrites: 0`.

# Sprint 19.4 - Production State Verification & Operator Repair Tools

- [x] Add internal diagnostics/status view for production sync health.
- [x] Add `/api/public-state/diagnostics` without secrets.
- [x] Add safe operator repair actions for catch-up and rebuilds.
- [x] Add stale-state repair triggers on public reads.
- [x] Add targeted regression tests for diagnostics and idempotent rebuilds.
- [x] Run build, typecheck, test, and required DB tests.

## Review

- `npm run build` passed.
- `npx tsc -p tsconfig.server.json --noEmit` passed.
- `npx vitest run src/test/publicDashboardData.test.ts src/test/publicDashboardPages.test.tsx src/test/operatorPage.test.tsx` passed.
- `node --test dist/test-db/db-node-test.js dist/test-db/result-persistence-node-test.js dist/test-db/manual-result-correction-node-test.js dist/test-db/top-scorer-standings-node-test.js dist/test-db/matchday-simulation-node-test.js dist/test-db/public-state-health-node-test.js` passed.
- `npm run validate:prediction-seeds` passed.
- Local HTTP smoke confirmed `/api/public-state/diagnostics`, `/api/public-dashboard`, and `/operator` return `200` with `no-store` cache headers.

# Sprint 19.6 - Automatic Top Scorer Repair

- [x] Add automatic full public-state refresh after confirmed final results.
- [x] Add startup backfill for confirmed provider scorer data.
- [x] Keep public-read stale scorer repair automatic, with operator buttons as fallback only.
- [x] Prevent repeated provider observations from duplicating scorer facts.
- [x] Add targeted DB regression coverage for automatic final-result scorer sync and startup repair.
- [x] Run build, typecheck, app tests, and scorer/result DB tests.

## Review

- `npm run build` passed.
- `npx tsc -p tsconfig.server.json --noEmit` passed.
- `npm run test` passed.
- `node --test dist/test-db/automatic-public-state-sync-node-test.js` passed.
- `node --test dist/test-db/top-scorer-standings-node-test.js` passed.
- `node --test dist/test-db/public-state-health-node-test.js` passed.
- `node --test dist/test-db/result-persistence-node-test.js` passed.
- `node --test dist/test-db/manual-result-correction-node-test.js` passed.

# Sprint 26 - Top Scorer Identity & Prediction Sync Fix

- [x] Audit provider scorer parsing and scorer name normalization.
- [x] Preserve raw provider names for Messi, Mbappe, Salah, and accented names while removing event markers.
- [x] Add robust scorer identity matching with canonical ids where available and alias fallback.
- [x] Make prediction-player cards read current goals from the same scorer dataset as public top scorers.
- [x] Add regression coverage for hat-tricks, 2-goal scorers, accented aliases, table/card consistency, and corruption prevention.
- [x] Run targeted tests plus build/typecheck.
- [x] Commit, push to `origin/main`, and verify `HEAD == origin/main`.

## Review

- Production audit confirmed raw OpenWorldCup scorer names are intact (`Lionel Messi`, `K. Mbappe`, accented names); corruption was in stored/derived scorer identity handling.
- `npm run build` passed.
- `npx tsc -p tsconfig.server.json --noEmit --pretty false` passed.
- `npx vitest run src/test/scorerIdentity.test.ts src/test/openWorldCupResultProvider.test.ts src/test/predictionViewModels.test.ts src/test/publicDashboardPages.test.tsx src/test/pointsEngine.test.ts src/test/scoring.test.ts` passed.
- `node --test dist/test-db/top-scorer-standings-node-test.js dist/test-db/public-state-health-node-test.js dist/test-db/result-persistence-node-test.js dist/test-db/manual-result-correction-node-test.js` passed.
- Extra `npx tsc -p tsconfig.json --noEmit --pretty false` still reports existing client/test type errors outside this scorer fix; the project build path remains green.

# Sprint 27 - KOV Top 3 Leaderboard Scoring

- [x] Audit current KOV leaderboard aggregation and production payload.
- [x] Replace KOV score with the sum of the top 3 individual player scores from that KOV.
- [x] Keep KOV player count and individual leaderboard scoring unchanged.
- [x] Display the same top 3 contributors used in the KOV score.
- [x] Add regression coverage for many-player KOVs, top-three contributor sums, and fewer-than-three-player KOVs.
- [x] Run targeted tests plus build/typecheck.
- [x] Commit, push to `origin/main`, and verify `HEAD == origin/main`.

## Review

- Production audit confirmed the current payload was using all-player totals, for example Rae showed `totalPoints: 810` while its displayed top 3 summed to 122.
- `npx vitest run src/test/countyLeaderboard.test.ts src/test/publicDashboardData.test.ts --reporter=verbose` passed.
- `npx tsc -p tsconfig.server.json --noEmit --pretty false` passed.
- `npm run build` passed.
- Extra `npx tsc -p tsconfig.json --noEmit --pretty false` still reports existing client/test type errors outside this KOV scoring fix; the project build path remains green.

# Sprint 28 - Poster-Inspired Leaderboard Visual Direction

- [x] Inspect the local poster reference without copying private text or leaderboard data.
- [x] Apply bright blue competition-panel styling to leaderboard surfaces.
- [x] Convert player, scorer, and KOV leaderboard rows to compact white rows with medal rank badges.
- [x] Show team flags and KOV crests in compact leaderboard preview/table rows.
- [x] Keep scoring, player counts, and live data sources unchanged.
- [x] Run targeted tests, build, and visual smoke.

## Review

- Used `C:\Users\Kasutaja\Documents\Jalka MM APP\Uploaded poester.jpg` as style reference only.
- `npx vitest run src/test/publicDashboardPages.test.tsx src/test/publicDashboardData.test.ts src/test/countyLeaderboard.test.ts --reporter=verbose` passed.
- `npx tsc -p tsconfig.server.json --noEmit --pretty false` passed.
- `npm run build` passed.
- Playwright visual smoke captured landing, leaderboard, and tournament screenshots under `tmp/poster-visual-smoke/`; mobile KOV table was corrected to avoid oversized oval rows and horizontal overflow.
- Extra `npx tsc -p tsconfig.json --noEmit --pretty false` still reports existing client/test type errors outside this visual update; the project build path remains green.
