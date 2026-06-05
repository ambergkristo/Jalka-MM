# MM 2026 Tournament & Prediction Tracker

Public read-only dashboard for a private MM 2026 prediction league.

The app is being reset from a prediction-submission product into a public tournament and prediction-league tracker. Final predictions will be collected outside the app in Excel, converted later into JSON/seed data, and then displayed through the existing public Render URL.

The Render URL stays in use as the public entry point. Visitors do not log in, register, submit predictions, edit predictions, or wait for deadline states inside the app.

## Product Direction

The app will become a public dashboard for following:

- Landing dashboard
- Today's matches
- Latest results
- Leaderboard
- Player prediction profiles
- Group standings
- Playoff bracket
- Top scorer standings
- Automatic match result updates

Prediction submission is no longer in scope. The previous login, registration, prediction forms, admin approval, final submission, and deadline UX are legacy functionality and should be removed in a later sprint.

## Data Direction

- Excel remains the initial source of truth for final player predictions.
- A later import step will convert the final Excel file into JSON or seed data.
- Prediction seed files live under `src/data/` and are loaded through `src/domain/predictionRepository.ts`.
- Match prediction points are calculated by `src/domain/pointsEngine.ts` using the MVP scoring rules in `docs/SCORING_RULES.md`.
- The database is the runtime source of truth after data is imported.
- Match results will later be updated by a separate results agent or cron workflow.
- Leaderboard entries will be rebuilt after result updates and saved to the database.
- The frontend reads saved leaderboard entries only; it does not calculate rankings client-side.

Future prediction workflow:

```text
Excel
-> JSON conversion
-> Seed files in src/data/
-> PredictionRepository
-> Application pages
```

The current seed repository validates unique player ids, missing player references, group prediction completeness, duplicate group predictions, and valid group ids. Excel import and admin upload tools are intentionally not implemented.

Developer-only Excel import workflow:

```bash
npm run import:excel-seeds
npm run validate:prediction-seeds
```

The importer reads `imports/data.xlsx`, writes public JSON seed files under `src/data/`, and generates `imports/import-report.json`. Excel files are not committed and are never parsed by the production app. See `docs/EXCEL_IMPORT.md` for the current workbook mapping and limitations.

## Planned Pages

- Landing dashboard: summary of today, latest results, leaderboard preview, and navigation.
- Results: all match results and status.
- Leaderboard: clean public ranking table.
- Player detail: full-screen public profile route for one player's predictions and scoring.
- Tournament center: group standings, playoff bracket, top scorers, and tournament results.

## Current App State

Sprint 1 reset is in place. The repository now contains the foundation of the public read-only tracker:

- Public React/Vite app shell
- Mobile-first navigation
- Premium Landing Dashboard with matchday, latest results, leaderboard, group leaders, and quick navigation sections
- Premium leaderboard with top-three highlighting and player profile links
- Rich player profile pages with summary metrics, predicted champion, top scorer, knockout bracket, and group prediction accordions
- Complete mock-data Tournament Center with summary metrics, Groups A-L standings, knockout progression, top scorers, statistics, and stage progress
- Mock-default backend results-agent foundation with provider abstraction, polling scheduler, update cycle, persisted match results, persisted leaderboard rebuilds, and catch-up endpoints
- Mock-default result provider chain scaffold with API-Football, football-data.org, and optional Sportmonks adapters disabled until configured
- Prediction seed-data architecture for players, leaderboard entries, group predictions, knockout predictions, and awards predictions
- Placeholder results page
- Read-only API health/state endpoints
- Tournament data seeding and validation
- No login UI
- No registration UI
- No admin UI
- No prediction submission forms
- No deadline or lock UX

Planning documents live in `docs/`:

- `docs/MASTERPLAN.md`
- `docs/DATA_MODEL.md`
- `docs/SCORING_RULES.md`
- `docs/RESULTS_AGENT.md`
- `docs/RESULT_PROVIDER_OPTIONS.md`
- `docs/UI_UX.md`
- `docs/SPRINTS.md`
- `docs/LEGACY_AUDIT.md`

## Development

Existing scripts are retained until Sprint 1 decides what to keep or remove:

```bash
npm install
npm test
npm run build
npm run import:excel-seeds
npm run validate:prediction-seeds
npm run ping:render
npm run validate:tournament-data
npm run audit:tournament-data
```

## Render Keepalive

The repository includes a scheduled GitHub Actions workflow at `.github/workflows/render-keepalive.yml`.

It pings the public Render URL every 14 minutes:

```text
https://jalka-mm.onrender.com
```

The same check can be run manually:

```bash
npm run ping:render
```

This is a lightweight keepalive helper. GitHub scheduled workflows can be delayed by GitHub's runner availability, so a paid always-on Render instance remains the most reliable option if zero hibernation is required.

## Routes

- `/`: Premium mock-data landing dashboard with hero status, Today's Matches, Latest Results, Top 5 Leaderboard, Group Leaders, and Quick Navigation.
- `/leaderboard`: Seed-data public leaderboard with rank movement, top-three highlighting, points, exact scores, and hit rate.
- `/player/:playerId`: Seed-data public player profile with prediction summary, champion/top scorer picks, playoff bracket, and group prediction accordions.
- `/results`: Placeholder matches and results page.
- `/tournament`: Mock-data Tournament Center with tournament summary, all group standings, mobile-first knockout progression, top scorers, statistics, and match progress by stage.
- `/not-found`: 404 page.

## API

- `GET /api/state`: public read-only app state metadata.
- `GET /api/health`: public health check.
- `GET /api/leaderboard`: persisted leaderboard entries when available; seed leaderboard fallback before the first rebuild.
- `GET /api/public-dashboard`: confirmed public results, recalculated group standings, group leaders, top scorers, tournament summary, and stage progress.
- `GET /api/results-agent/status`: mock-default results-agent status with persisted stale-match and leaderboard rebuild metadata.
- `POST /api/results-agent/run`: mock-default catch-up/update cycle endpoint that upserts match results and persisted leaderboard rows; must be protected before any real provider or production writes are connected.

All old auth, admin, approval, prediction submission, bonus form, deadline, and lock APIs have been removed from the active server.

## Result Provider Configuration

The default result provider is still mock. Real providers require external credentials and confirmed fixture mapping. The recommended low-cost strategy is API-Football as the primary candidate, football-data.org as a secondary verifier, and Sportmonks as an optional paid fallback.

```bash
RESULTS_PROVIDER=mock
RESULTS_PROVIDER_CHAIN=mock
# `dry-run` can fetch a real provider without writing DB changes.
RESULTS_WRITE_MODE=mock
# Single-provider fallback confirmation delay. Two-provider agreement can confirm immediately.
RESULT_CONFIRMATION_DELAY_MINUTES=10
# API_FOOTBALL_API_KEY=
# API_FOOTBALL_API_BASE_URL=https://v3.football.api-sports.io
# FOOTBALL_DATA_API_KEY=
# FOOTBALL_DATA_API_BASE_URL=https://api.football-data.org/v4
# SPORTMONKS_API_KEY=
# SPORTMONKS_API_BASE_URL=https://api.sportmonks.com
# RESULTS_AGENT_SECRET=
```

See `.env.example`, `docs/RESULTS_AGENT.md`, and `docs/RESULT_PROVIDER_OPTIONS.md` before enabling a real provider.

Useful provider operations:

```bash
npm run validate:provider-match-map
npm run simulate:reset
npm run simulate:matchday1
npm run simulate:matchday1:disagreement
```

Live result-agent writes require `x-results-agent-secret: <RESULTS_AGENT_SECRET>` on `POST /api/results-agent/run`. Mock mode remains simple for local development.

Public results follow a confirmed-results-only policy. Provider final scores are first treated as provisional unless two independent providers agree immediately, or the same provider repeats the same final score after `RESULT_CONFIRMATION_DELAY_MINUTES`. The leaderboard rebuilds only from confirmed final scores.

The matchday simulation is a developer workflow for proving the full confirmed-result path without external APIs. See `docs/E2E_SIMULATION.md`.
