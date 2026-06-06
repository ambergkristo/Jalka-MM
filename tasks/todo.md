# Sprint 21 - Production Readiness Audit

- [x] Create `docs/PRODUCTION_READINESS.md`.
- [x] Document Render environment requirements.
- [x] Document public route smoke checks.
- [x] Document simulation acceptance flow.
- [x] Document result-agent mock, dry-run, live, and secret rules.
- [x] Document provider readiness risks.
- [x] Document final Excel workflow and email/privacy rule.
- [x] Document qualifier resolver gap as a blocker before knockouts.
- [x] Update `.env.example` and README where current behavior was outdated.
- [x] Run `npm run build`.
- [x] Run simulation checklist commands if time allows.
- [x] Commit, push, and verify `HEAD == origin/main`.

## Immediate Release Blockers

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

- Build manual result correction/fallback workflow with audit trail.
- Final mobile smoke pass on `/`, `/results`, `/leaderboard`, `/player/kristo-amberg`, `/tournament`, and `/not-found`.
- Verify free provider request budgets and fallback plan before tournament start.

## Review

- `npm run build` passed.
- `npm run simulate:reset` passed.
- `npm run simulate:matchday1` passed.
- Final `npm run simulate:reset` passed and returned the app to pre-result mode.
