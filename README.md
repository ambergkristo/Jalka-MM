# World Cup 2026 Friends Predictor

Mobile-first PWA MVP for a private World Cup prediction league.

## Current Features

- Player login with first name, surname, and personal password.
- Public landing page with deadline-aware primary actions.
- Mobile-readable Estonian rules view.
- Public player registration with mandatory first name/surname, optional contact field, personal password, and pending/approved/disabled approval status.
- Server-side HTTP-only sessions for player/admin authorization.
- Mobile match prediction entry for all 104 World Cup 2026-shaped matches, including country selection for playoff bracket slots.
- Draft saving plus separate final prediction confirmation for fair tie-break timestamps.
- Bonus prediction flow for group winners, group second places, group qualifiers, knockout round participants, third-place winner, champion, and top scorer.
- Results/overview screen for post-deadline match results, own prediction comparison, points, and leaderboard preview.
- Admin match result entry.
- Admin bonus-result entry, including multiple tied top scorers.
- Admin lock/unlock and deadline configuration.
- Named admin login for `Kristo` and `Argo`; admin actions are audited with the acting organizer identity.
- Admin player approval screen. Only approved players with final submitted predictions appear in the official leaderboard.
- Admin-only selected test-user removal for cleaning deployment test data before launch.
- Runtime config boundary for `local`, `staging`, and `production` modes.
- SQLite backup command and explicit destructive reset guardrails.
- Real leaderboard calculated from stored predictions, results, and score breakdowns.
- Participant score detail view with match and bonus explanations.
- Manual result provider boundary for future live-score integrations.
- Dark, mobile-first match prediction screen with grouped stages, team names, codes, flags, and Estonia-time kickoff display when verified.
- Estonian player/admin UI and a live countdown to the prediction deadline.
- Competition-state-aware routing for open predictions, locked predictions, live tournament, and finished tournament states.
- Reliable local SVG flags via `flag-icons`, with UTF-8 emoji flags retained as tournament metadata fallback.
- Tournament data source layer with explicit verification status and validation.
- Safe tournament-data seeding that preserves players, predictions, and results.
- Bracket slot/progression and basic group standings domain foundations.

## Run Locally

```bash
cd "C:\Users\Kasutaja\Documents\Jalka MM APP"
npm install
npm test
npm run build
npm run seed:tournament-data
npm run backup:db
npm run dev
```

Open `http://localhost:5174`. The API runs on `http://localhost:8787`.

In production, the Node server started with `node dist/server/index.js` serves both `/api/*` routes and the built React/Vite frontend from `dist/client`. The root URL `/` returns `dist/client/index.html`, and SPA routes fall back to that HTML while unknown `/api/*` routes remain JSON API 404 responses.

Commands:

- `npm install`: install dependencies
- `npm test`: run pure scoring tests and SQLite stored-data tests
- `npm run build`: compile the API and build the PWA
- `npm run seed`: alias for safe tournament-data update
- `npm run seed:tournament-data`: safely update teams, groups, and matches without deleting players, predictions, or results
- `npm run seed:demo`: destructive local reset followed by demo player seeding
- `npm run reset:dev`: destructive local development wipe
- `npm run backup:db`: timestamped copy of the local SQLite database into `backups/`
- `npm run dev`: run API and Vite dev server
- `npm run validate:tournament-data`: validate tournament JSON source files
- `npm run audit:tournament-data`: print an operator readiness report for tournament data

## Demo Access

- Player invite code: `FRIENDS2026`
- Admin accounts: `Kristo` and `Argo`. Set `BOOTSTRAP_ADMIN_KRISTO_PASSWORD` and `BOOTSTRAP_ADMIN_ARGO_PASSWORD` locally before `npm run db:migrate` or server startup.

New player registrations start as `pending`. Pending players may save drafts and confirm a final prediction, but they do not appear in the official leaderboard until the admin approves them.

## Architecture

- `src/domain`: pure TypeScript tournament data and scoring logic. No React, HTTP, or database dependencies.
- `src/data/worldcup2026`: JSON source files for tournament metadata, teams, groups, matches, and bracket slots.
- `src/server`: Node TypeScript API using built-in SQLite (`node:sqlite`) and a manual result provider boundary.
- `src/client`: React + Vite PWA UI for landing, rules, prediction entry, results overview, leaderboard, and admin result entry.
- `data/worldcup2026.sqlite`: local SQLite database created at runtime.

The database schema includes `users`, `players`, `admin_accounts`, `sessions`, `competitions`, `teams`, `groups`, `matches`, `predictions`, `prediction_submissions`, `actual_results`, `bonus_predictions`, `bonus_results`, `score_breakdowns`, `leaderboard_snapshots`, and `admin_audit_log`.

## Scoring

- Exact score: 6 points
- Correct result and goal difference: 4 points
- Correct winner/draw only: 2 points
- Incorrect result: 0 points
- Group winner: 10 points
- Group second place: 5 points
- Advancing team: 3 points per correct team
- Round of 16: 15 points per correct country
- Quarter-final: 20 points per correct country
- Semi-final: 25 points per correct country
- Final: 30 points per correct country
- Third-place winner: 40 points
- Champion: 100 points
- Top scorer: 50 points split evenly across tied top scorers

Knockout match score points are based on the home-away bracket slot score. Players also select predicted countries for each playoff match card so the prediction is readable, but these match-card country choices do not affect match-score points and are not forced to form a coherent bracket tree. Team identity points are handled separately in the bonus/progression scoring categories.

## Admin Flow

Log in through `Korraldajale` as `Kristo` or `Argo`, open the Admin tab, enter match results, edit the prediction deadline, lock/unlock predictions, enter bonus results, approve/disable players, and trigger recalculation. Every result, deadline, bonus-result, deletion, and player-status change is written to `admin_audit_log` with the acting admin identity.

Admin actions require a server-side authenticated admin session. Normal players do not see the Admin tab, and non-admin admin requests are rejected server-side.

Before inviting real players, remove only explicitly identified deployment test users from the Admin tab with `Eemalda testkasutaja`. The action requires an authenticated named admin session, selecting one specific player, and typing the exact player display name before the final delete button is enabled. It deletes only the selected player's user row, match predictions, bonus predictions, submission timestamp, and score rows, then writes `player.deleted` to `admin_audit_log` with the acting admin identity. It does not reset tournament data, results, other players, or the production database.

## Landing, Rules, And Results Flow

The public root URL opens a landing page instead of dropping directly into registration. It explains the private friends competition and offers `Mine ennustama` / `Vaata tulemusi` plus `Reeglid`.

The app derives player-facing state from the prediction deadline, manual lock flag, and stored match results:

- `predictions_open`: primary action goes to `Ennustused`.
- `predictions_locked_before_tournament`: forms remain read-only and the primary action goes to overview.
- `tournament_live`: `Tulemused` becomes the main follow-along view.
- `tournament_finished`: primary action goes to final results/leaderboard summary.

The `Tulemused` view uses only stored manual results and score breakdowns. It shows `Tulemus sisestamata` until the admin enters a result and does not claim automated live data.

Players can use `Logi välja` to end the server session. This does not delete the player record or any predictions.

## Public Registration And Approval

The public flow is intentionally simple for a private friends league:

1. Admin shares the app URL.
2. Player registers with first name, surname, optional contact, league invite code, and personal password.
3. Player can immediately fill drafts and confirm a final match/bonus prediction.
4. Player pays the entry fee outside the app by personal transfer to the admin.
5. Admin confirms payment manually and approves the player in the Admin tab.

The app does not collect money, process card payments, connect to banks, or store payment credentials.

Player statuses:

- `pending`: default for new players; predictions are saved but excluded from the official leaderboard.
- `approved`: included in official leaderboard and ranking only after a final prediction has been submitted.
- `disabled`: excluded from official leaderboard and scoring views.

If a pending player confirms a final prediction before the deadline and is approved later, the final submission timestamp remains the leaderboard tie-break timestamp. Approval time is not used as the tie-breaker. Saving a draft alone does not create a tie-break timestamp; if a player edits after final confirmation, they must confirm again and the timestamp updates.

## Match Prediction Flow

Players can save progress with `Salvesta mustand`. The official entry is created only with `Kinnita lõplik ennustus`; all match predictions, required bonus fields, playoff country selections, and penalty winners for tied playoff scores must be complete.

For playoff matches, players choose the predicted country for each match-side slot from the tournament team registry, then enter the score. Technical bracket labels are shown only as helper text, for example `A-grupi teine koht`, `Mängu 73 võitja`, or `Parim 3. koha meeskond`. Every playoff match from `1/16-finaalid` through `Finaal` is independently editable: later-round country choices are not auto-populated from earlier predicted winners and are not required to be logically consistent with earlier rounds or bonus selections.

## Bonus Prediction Flow

Use the Bonus tab as a player. Select each group winner, group second place, and two qualifiers. Then select teams reaching Round of 16, quarter-finals, semi-finals, and the final, plus the third-place winner, champion, and top scorer. The screen shows how many required fields are still missing and saves through the API to `bonus_predictions`.

## Admin Bonus Results

Use the Admin tab. Enter final group outcomes, knockout round participants, third-place winner, champion, and top scorer results. Multiple tied top scorers can be entered separated by commas or new lines. Saving bonus results writes to `bonus_results` and recalculates score breakdowns.

## Data Storage And Safety

Local data is stored in `data/worldcup2026.sqlite` unless `WORLDCUP_DB_PATH` is set.

Tournament structure data is separate from competition/user data:

- Tournament structure: `teams`, `groups`, `matches`, bracket slots, kickoff times, and metadata from `src/data/worldcup2026`.
- Competition/user data: players, prediction submissions, match predictions, bonus predictions, actual results, bonus results, score breakdowns, leaderboard snapshots, and admin audit log.

Safe commands:

- `npm run seed` / `npm run seed:tournament-data`: updates tournament structure tables and preserves players, predictions, results, and audit history.
- `npm run validate:tournament-data`: validates JSON source files only.
- `npm run audit:tournament-data`: reports readiness and unresolved data.

After deploying tournament-data fixes to production, run only the safe update:

```bash
npm run seed:tournament-data
```

This updates tournament structure rows such as teams, localized names, emoji flags, fixtures, kickoff times, and the default prediction deadline. It preserves players, approval statuses, predictions, results, score breakdowns, leaderboard snapshots, and the admin audit log.

Destructive commands:

- `npm run seed:demo`: wipes local data, then creates demo players.
- `npm run reset:dev`: wipes local development data.

Destructive commands are intentionally explicit, require `--confirm=DELETE_LOCAL_DATA` or `ALLOW_DESTRUCTIVE_COMMANDS=true`, and always refuse `APP_ENV=production`. The package scripts include the confirmation flag only for the clearly named dev commands.

For real competition use, back up the SQLite database before updates:

```powershell
Copy-Item .\data\worldcup2026.sqlite ".\data\worldcup2026-backup-$(Get-Date -Format yyyyMMdd-HHmmss).sqlite"
```

or run:

```bash
npm run backup:db
```

Before hosting publicly, configure backups, use Postgres/Supabase, keep `SESSION_SECRET` stable, and avoid treating local SQLite/demo mode as production-safe.

## Runtime Configuration

Configuration is read from environment variables:

- `APP_ENV`: `local`, `staging`, or `production`. Defaults to `local`.
- `DATABASE_MODE`: `sqlite` or `postgres`. Use `postgres` on Render/Supabase.
- `SQLITE_DB_PATH` or `WORLDCUP_DB_PATH`: local SQLite file path. Defaults to `data/worldcup2026.sqlite`.
- `DATABASE_URL`: required when `DATABASE_MODE=postgres`. Use the Supabase pooled Postgres connection string.
- `SESSION_SECRET`: required in production; signs HTTP-only server session cookies.
- `LEAGUE_INVITE_CODE`: private registration invite code. Defaults to `FRIENDS2026` for local use.
- `BOOTSTRAP_ADMIN_KRISTO_PASSWORD`: creates or updates the named `Kristo` admin account during migration/startup.
- `BOOTSTRAP_ADMIN_ARGO_PASSWORD`: creates or updates the named `Argo` admin account during migration/startup.
- `PUBLIC_APP_BASE_URL`: public URL shown in status/config contexts.
- `TOURNAMENT_DATA_MODE`: `seeded`, `partial_official`, or `official`.
- `ALLOW_DESTRUCTIVE_COMMANDS`: allows destructive local reset commands outside production.

Recommended production database shape is Supabase Postgres with automated backups. SQLite is local development only for Render Free because Render Free Web Services do not provide reliable persistent app disk for this use case.

## Render And Supabase Deployment

Build:

```bash
npm install
npm run validate:tournament-data
npm run audit:tournament-data
npm run build
```

Start API:

```bash
APP_ENV=production SESSION_SECRET=replace-me DATABASE_MODE=postgres DATABASE_URL=postgres://... node dist/server/index.js
```

Render Free setup:

- Create a Supabase project.
- Copy the pooled Postgres connection string from Supabase and use it as `DATABASE_URL`.
- Create a Render Web Service from `https://github.com/ambergkristo/Jalka-MM`.
- Build command: `npm install && npm run build`.
- Start command: `node dist/server/index.js`.
- Environment variables:
  - `APP_ENV=production`
  - `DATABASE_MODE=postgres`
  - `DATABASE_URL=<Supabase pooled Postgres connection string>`
  - `SESSION_SECRET=<strong random secret>`
  - `LEAGUE_INVITE_CODE=<private league invite code>`
  - `BOOTSTRAP_ADMIN_KRISTO_PASSWORD=<strong private password>`
  - `BOOTSTRAP_ADMIN_ARGO_PASSWORD=<different strong private password>`
  - `PUBLIC_APP_BASE_URL=<Render URL>`
  - `TOURNAMENT_DATA_MODE=partial_official`

After setting environment variables, run these from a Render shell or local shell with the same production env vars:

```bash
npm run db:migrate
npm run seed:tournament-data
```

Both commands are idempotent and non-destructive for player predictions/results. `seed:tournament-data` only updates tournament structure tables.

After `db:migrate` creates the named admin accounts, remove the `BOOTSTRAP_ADMIN_*` variables from Render if you do not want future deploys to rotate those passwords. Keep `SESSION_SECRET` unchanged across deploys; changing it logs everyone out.

Verify deployment:

- Open `<Render URL>/api/health`.
- Confirm `databaseMode` is `postgres`.
- Confirm `databaseConnectivity` is `true`.
- Confirm `sessionSecretConfigured` is `true` and `namedAdminAccounts` is `2`.
- Open the app URL and register a test player.
- Confirm the landing page and `Reeglid` view are visible.
- Confirm returning login requires the personal password, not only the shared invite code.
- Save match and bonus predictions.
- Confirm final prediction submission and timestamp.
- Approve the player as admin.
- Enter one manual match result and confirm `Tulemused` shows the result, own prediction, and points.
- Restart/redeploy the Render service.
- Confirm the player and predictions still exist.

If deployment fails, check Render logs first for missing `SESSION_SECRET`, missing `DATABASE_URL`, or Supabase connection errors. The health endpoint never returns secret values.

Pre-launch checklist:

- `APP_ENV` is not accidentally `local` in production.
- `SESSION_SECRET` is configured outside source code.
- Kristo and Argo can each log in with separate passwords.
- Database persistence is confirmed across deploys/restarts.
- Backup command has been run and restore procedure is understood.
- `npm run audit:tournament-data` passes and unresolved kickoff times are reviewed.
- Prediction deadline and lock behavior are configured.
- Registration and admin approval flow are tested.
- Public leaderboard includes approved players only.
- Pending and disabled players are excluded from official ranking.
- Test users are removed one by one through the admin `Eemalda testkasutaja` flow only after live verification.

## Tournament Data Source

Tournament source files live in `src/data/worldcup2026`:

- `metadata.json`: source name/reference, retrieved timestamp, and `verificationStatus`
- `teams.json`: 48 team or slot records
- `groups.json`: 12 group records
- `matches.json`: 104 matches
- `bracket.json`: knockout slot placeholders

Current `verificationStatus` is `partial_official`. Official group/team data plus all 72 group-stage match IDs, fixtures, venues, dates, and kickoff timestamps are encoded from the FIFA World Cup 2026 match schedule PDF. Knockout teams and final tournament outcomes remain unresolved until play begins, so the whole tournament data set is not marked fully official. The audit output lists verified group-stage kickoff counts and every match ID still missing kickoff time.

```bash
npm run validate:tournament-data
npm run audit:tournament-data
```

Validation checks metadata, allowed verification statuses, team/group/match counts, duplicate team IDs, duplicate match numbers, invalid team and group references, corrupted concrete-team flags, date/TBC handling, knockout slot usage, unresolved kickoff-time counts, and required source metadata.

The match seed keeps the 104-match shape: 72 group matches and 32 knockout matches. Group-stage matches use stable team IDs from the JSON registry, with Estonian display names and technical short codes in the UI. Knockout matches use clear bracket slot labels such as `Winner Group A`, `3rd Group C/D/E`, or `Winner Match 73` because exact knockout teams depend on progression.

Team badges render local SVG flags from the `flag-icons` package for cross-platform consistency, including Windows browsers where emoji-only flag sequences may appear as regional letters such as `MX`. The country code remains secondary text under the Estonian country name. No external flag CDN is used.

Group-stage kickoff times are stored as UTC ISO timestamps and displayed in Estonia time (`Europe/Tallinn`) with Estonian formatting, for example `11. juuni · 22:00 Eesti aeg`. If the value is unknown or invalid, the app shows `Aeg täpsustamisel`; broken labels like `Invalid Date` should not appear.

## Bracket And Standings Foundations

`src/domain/bracket.ts` formats and resolves bracket slots for concrete teams, group winners, group runner-ups, best-third placeholders, previous-match winners, and previous-match losers.

`src/domain/standings.ts` calculates basic group standings: played, wins, draws, losses, goals for, goals against, goal difference, and points. Sorting currently uses points, goal difference, and goals for. Full official tie-break rules are intentionally not claimed yet.

## Score Explanations

Open the Leaderboard tab and choose Details for a participant, or open the Details tab for the current player. The detail view reads `score_breakdowns` through `/api/breakdown` and displays match and bonus explanation labels such as `6p: exact score correct` or `4p: correct result and goal difference`.

## External Result Providers

`src/server/providers.ts` defines `ManualResultProvider`, `ExternalFootballResultProvider`, and `NormalizedMatchResult`.

The app is fully functional with manual admin updates. Future adapters for API-Football, football-data.org, SportMonks, or LiveScore API should implement `ExternalFootballResultProvider` and return normalized match results. API key placeholders are documented in that file but are not required for the MVP.

## Known Limitations

- Current tournament data is only partially official because knockout participants and outcomes are unresolved until the tournament is played.
- Full official FIFA tie-break rules are not complete.
- Knockout best-third-place mapping still requires verified official mapping.
- Knockout bracket slots are structurally seeded; automatic bracket progression is only foundational.
- External live-score providers are not implemented yet.
- Local SQLite mode needs backups and hosting hardening before public production use.
- Authentication is simple private-league MVP auth: a shared league invite code allows registration, but returning access requires the player's own password and a server-side session.
- Node prints an experimental warning for built-in SQLite on Node 24.

## Git Status

The project repository is `https://github.com/ambergkristo/Jalka-MM` on branch `main`.

## Reference Files

`Juhend 2026.pdf` and `Ennustus 2026.xlsx` were found in `C:\Users\Kasutaja\Documents\Jalka MM APP` and used as product references for scoring categories, prediction coverage, and tournament structure. The app does not copy spreadsheet formulas, templates, branding, or UI, and has no runtime dependency on those files.
