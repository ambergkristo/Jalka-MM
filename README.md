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
- The database is the runtime source of truth after data is imported.
- Match results will later be updated by a separate results agent or cron workflow.
- Leaderboard entries will be rebuilt after result updates and saved to the database.
- The frontend reads saved leaderboard entries only; it does not calculate rankings client-side.

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
- Placeholder secondary pages
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
- `docs/RESULTS_AGENT.md`
- `docs/UI_UX.md`
- `docs/SPRINTS.md`
- `docs/LEGACY_AUDIT.md`

## Development

Existing scripts are retained until Sprint 1 decides what to keep or remove:

```bash
npm install
npm test
npm run build
npm run validate:tournament-data
npm run audit:tournament-data
```

## Routes

- `/`: Premium mock-data landing dashboard with hero status, Today's Matches, Latest Results, Top 5 Leaderboard, Group Leaders, and Quick Navigation.
- `/leaderboard`: Placeholder public leaderboard table.
- `/player/:playerId`: Placeholder public player detail page.
- `/results`: Placeholder matches and results page.
- `/tournament`: Placeholder tournament center.
- `/not-found`: 404 page.

## API

- `GET /api/state`: public read-only app state metadata.
- `GET /api/health`: public health check.

All old auth, admin, approval, prediction submission, bonus form, deadline, and lock APIs have been removed from the active server.
