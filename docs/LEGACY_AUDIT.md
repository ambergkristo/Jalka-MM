# Legacy Audit

This audit documents the current repository state before implementation begins. The app still contains the previous prediction-submission product. Sprint 0 does not delete it.

## Repository Snapshot

Technology stack:

- React 18
- Vite
- TypeScript
- Node HTTP API
- SQLite/Postgres adapter layer
- Vitest

Useful existing foundations:

- `src/data/worldcup2026/` tournament JSON files
- `src/domain/scoring.ts` scoring logic, likely reusable after adapting to imported predictions
- `src/domain/standings.ts` group standings logic
- `src/domain/bracket.ts` bracket helpers
- `src/domain/tournamentData.ts` and validation/audit scripts
- `src/server/index.ts` API/static frontend serving skeleton
- `src/server/databaseAdapter.ts` database adapter boundary
- `src/server/providers.ts` provider interface placeholder
- `vite.config.ts`, `tsconfig.json`, `tsconfig.server.json`
- `package.json` scripts and dependency baseline
- Render-oriented production serving model described in the old README

## Old Prediction-Submission Features Present

The current app includes these legacy product areas:

- Player login and registration.
- Server-side HTTP-only sessions.
- Admin login.
- Admin player approval and disabling.
- Prediction deadline and manual lock controls.
- Match prediction forms.
- Bonus/special prediction forms.
- Draft saving.
- Final prediction submission.
- Admin result entry.
- Admin bonus-result entry.
- Admin test-user deletion.
- Auth-gated score breakdown access.
- Competition-state routing based on prediction deadline and result count.

These belong to the old product direction and should not define the new public read-only tracker.

## Prediction Forms

Likely related files:

- `src/client/components/MatchPredictions.tsx`
- `src/client/components/BonusPredictionPanel.tsx`
- `src/client/components/bonusDraft.ts`
- `src/client/App.tsx`
- `src/client/api.ts`
- `src/domain/predictedGroups.ts`
- `src/client/lib/messages.ts`
- `src/test/knockoutPredictionUx.test.tsx`
- `src/test/bonusFlow.test.tsx`
- `src/test/predictedGroups.test.ts`

Related server/database areas:

- `POST /api/predictions` in `src/server/index.ts`
- `POST /api/bonus-predictions` in `src/server/index.ts`
- `savePredictions` in `src/server/db.ts`
- `saveBonusPrediction` in `src/server/db.ts`
- `predictions` table
- `group_tie_resolutions` table
- `bonus_predictions` table

## Authentication

Likely related files:

- `src/server/auth.ts`
- `src/server/config.ts`
- `src/server/index.ts`
- `src/server/db.ts`
- `src/client/App.tsx`
- `src/client/api.ts`
- `src/test/config.test.ts`

Related concepts:

- `users` table
- `admin_accounts` table
- `sessions` table
- `SESSION_SECRET`
- `LEAGUE_INVITE_CODE`
- `BOOTSTRAP_ADMIN_KRISTO_PASSWORD`
- `BOOTSTRAP_ADMIN_ARGO_PASSWORD`
- `wc_session` cookie
- `/api/register`
- `/api/login`
- `/api/admin/login`
- `/api/logout`
- `/api/session`

## Admin Approval

Likely related files:

- `src/client/components/AdminPanel.tsx`
- `src/server/index.ts`
- `src/server/db.ts`
- `src/test/adminParticipantUi.test.tsx`

Related concepts:

- `players.status`
- `pending`, `approved`, `disabled`
- `approved_at`
- `admin_note`
- `/api/admin/player-status`
- `/api/admin/delete-player`
- `updatePlayerStatus`
- `deletePlayer`
- `admin_audit_log`

## Deadline Handling

Likely related files:

- `src/client/components/DeadlineBanner.tsx`
- `src/client/lib/deadline.ts`
- `src/client/lib/competitionState.ts`
- `src/client/components/LandingPage.tsx`
- `src/client/App.tsx`
- `src/server/index.ts`
- `src/server/db.ts`
- `src/test/competitionState.test.ts`
- `src/test/rm9Views.test.tsx`

Related concepts:

- `competitions.prediction_deadline`
- `competitions.predictions_locked`
- `/api/admin/deadline`
- `/api/admin/lock`
- `setDeadline`
- `setLock`
- `ensurePredictionsOpen`
- `predictions_open`
- `predictions_locked_before_tournament`

## User Submission Flow

Likely related files:

- `src/client/App.tsx`
- `src/client/components/MatchPredictions.tsx`
- `src/client/components/BonusPredictionPanel.tsx`
- `src/client/components/LandingPage.tsx`
- `src/client/api.ts`
- `src/server/index.ts`
- `src/server/db.ts`
- `src/domain/scoring.ts`
- `src/test/scoring.test.ts`

Related concepts:

- `/api/final-submit`
- `submitFinalPredictions`
- `prediction_submissions` table
- `final_submitted_at`
- `snapshot_hash`
- `revision`
- `is_final`
- `needs_final_confirmation`
- tie-break by submission time

## Bonus Prediction Input

Likely related files:

- `src/client/components/BonusPredictionPanel.tsx`
- `src/client/components/bonusDraft.ts`
- `src/client/components/AdminPanel.tsx`
- `src/domain/scoring.ts`
- `src/domain/types.ts`
- `src/test/bonusFlow.test.tsx`
- `src/test/scoring.test.ts`

Related concepts:

- `GroupBonusPrediction`
- `KnockoutBonusPrediction`
- `bonus_predictions`
- `bonus_results`
- `/api/bonus-predictions`
- `/api/admin/bonus-results`
- top scorer input
- champion, third-place winner, and knockout-round bonus selections

## Likely Sprint 1 Deletions

Delete or heavily rewrite:

- `src/client/components/MatchPredictions.tsx`
- `src/client/components/BonusPredictionPanel.tsx`
- `src/client/components/bonusDraft.ts`
- `src/client/components/DeadlineBanner.tsx`
- Login/register/admin sections inside `src/client/App.tsx`
- Auth and mutation calls in `src/client/api.ts`
- Admin participant approval UI inside `src/client/components/AdminPanel.tsx`
- Deadline and competition-state UX in `src/client/lib/deadline.ts` and `src/client/lib/competitionState.ts`
- Prediction submission, auth, admin approval, and deadline routes in `src/server/index.ts`
- Auth/session/admin/player-approval functions in `src/server/db.ts`
- Tables tied only to old auth/submission flow, after migration strategy is chosen
- Tests that only validate old form, approval, auth, deadline, or submission behavior

Potentially delete after replacement exists:

- `src/client/components/RulesView.tsx`, if rules are only about old submission mechanics.
- Old README-era demo access and deployment instructions.

## Likely Sprint 1 Keeps

Keep or adapt:

- Deploy config and production serving approach.
- `package.json` scripts, after pruning legacy-only scripts if needed.
- React/Vite setup.
- API skeleton in `src/server/index.ts`, after narrowing to public read-only endpoints.
- `src/server/databaseAdapter.ts`.
- `src/server/providers.ts`, as the seed for the future results-agent boundary.
- Runtime config pieces for `APP_ENV`, `DATABASE_MODE`, `DATABASE_URL`, and `PUBLIC_APP_BASE_URL`.
- `src/data/worldcup2026/` tournament data, if still accurate.
- `scripts/validate-tournament-data.mjs`.
- `scripts/audit-tournament-data.mjs`.
- `src/domain/tournamentValidation.ts`.
- `src/domain/tournamentData.ts`.
- `src/domain/standings.ts`.
- `src/domain/bracket.ts`.
- Scoring tests and scoring engine concepts, after adapting away from final submission timestamps and approved-player filtering.

## Risks For Sprint 1

- Current database schema mixes users, predictions, results, approvals, scoring, and snapshots. Plan a clean schema migration instead of deleting tables blindly.
- Existing leaderboard logic filters approved players with final submissions. The new product needs imported public players and saved leaderboard rows.
- Existing result flow is manual admin entry. The future direction needs automated result updates plus catch-up behavior.
- Existing UI is Estonian and form-oriented. The new app needs public dashboard routes and no login-first path.
- Existing tests assert old behavior and will need replacement, not only deletion.
