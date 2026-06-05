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

## Current Sprint

Sprint 0 is documentation and architecture lock only.

No new frontend features, large deletions, new dependencies, or product implementation are intended in this sprint. See the planning documents in `docs/`:

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

The current codebase still contains legacy prediction-submission functionality. Treat it as implementation debt scheduled for removal, not as the future product contract.
