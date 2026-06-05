# MM 2026 Tournament & Prediction Tracker Masterplan

## Product Purpose

MM 2026 Tournament & Prediction Tracker is a public read-only dashboard for a private prediction league. It lets league participants and viewers follow the tournament, compare final submitted predictions, review player profiles, and track the leaderboard as real match results arrive.

The product is no longer a prediction-submission app. Predictions are finalized outside the application before the tournament and imported later as trusted data.

## Users

- League participants who want to follow their own predictions and ranking.
- Friends, family, and other public viewers who want to follow the private league.
- The organizer, who maintains the final Excel prediction source outside the app.
- A future automated results agent, which updates match results and triggers recalculation.

## Access Model

The app is public and read-only.

- No login.
- No user registration.
- No prediction entry.
- No player-specific private session.
- No admin approval workflow.
- No deadline UX.

All visitors use the existing Render URL. The UI may expose public player routes and profile pages, but those pages only show imported final predictions and saved scoring data.

## Prediction Source Of Truth

Excel is the initial source of truth for final predictions.

The final prediction file is prepared outside the app. After the prediction deadline has passed outside the app process, the Excel file will be converted into structured JSON or seed data.

The app must not accept prediction edits or uploads during MVP.

## JSON And Seed Import Concept

The import workflow should later:

1. Read the finalized Excel prediction file outside the app.
2. Normalize player, match, group, knockout, awards, and top scorer predictions.
3. Produce versioned JSON or seed files.
4. Validate required fields and tournament references.
5. Seed the runtime database.

The import should be deterministic and repeatable. The generated data should be reviewable before production seeding.

## Runtime Source Of Truth

The database is the runtime source of truth after import.

Runtime data should include:

- Players
- Tournament matches
- Imported player predictions
- Imported group, knockout, awards, and top scorer predictions
- Actual match results
- Group standings
- Top scorer standings
- Leaderboard entries
- Result update history

The frontend should read API responses backed by saved database rows.

## Football API And Result Agent Concept

A future separate results agent or cron workflow will fetch match statuses and scores from a football data API. Candidate providers can include API-Football, football-data.org, SportMonks, LiveScore API, or another provider with reliable World Cup coverage.

The agent is separate from the public UI. It is responsible for:

- Fetching scheduled, live, and final result states.
- Updating match scores and statuses.
- Detecting final results.
- Triggering leaderboard rebuilds after finalized result changes.
- Recording update metadata for observability.

## Leaderboard Rebuild Strategy

Leaderboard calculation belongs on the server.

Locked decision:

> Leaderboard is rebuilt after result updates and saved to the database. Frontend reads saved leaderboard entries only.

This keeps the public UI fast, predictable, and consistent across visitors. It also avoids duplicating scoring logic in the browser.

The scoring engine should rebuild all affected leaderboard rows after any finalized result update. For MVP, rebuilding the full leaderboard after each finalized result is acceptable.

## Render Hibernate And Catch-Up Strategy

Render free services may hibernate. The MVP should handle missed polling windows with a simple catch-up strategy.

When the web service wakes and stale match data exists:

1. An API request or startup check detects stale scheduled/live matches.
2. The app triggers a catch-up result update.
3. The result agent fetches current statuses and scores.
4. Finalized results are locked.
5. The leaderboard is rebuilt and saved.

No complex pending queue is needed for MVP.

## Main Pages

### Landing Dashboard

Public first screen with:

- Today's matches
- Latest results
- Top leaderboard preview
- Group leaders
- Main navigation to Results, Leaderboard, and Tournament Center

### Results

Public match list grouped by date, stage, and status. Shows scheduled, live, full-time, extra-time, penalties, postponed, and suspended states.

### Leaderboard

Clean ranking table backed by saved leaderboard entries. It should show rank, player, points, exact scores, correct results, hit rate, and last updated timestamp where useful.

### Player Detail

Full-screen route for one player, not a modal. Shows player prediction profile, score breakdown, predicted champion, predicted top scorer, playoff prediction, and group prediction accordions.

### Tournament Center

Tournament-focused area with group standings, playoff bracket, top scorers, and all results.

## MVP Scope

- Public read-only app shell.
- Route skeleton for Landing, Results, Leaderboard, Player Detail, and Tournament Center.
- Imported prediction data model.
- Runtime database model for tournament data, predictions, results, and saved leaderboard entries.
- Server-side scoring and leaderboard rebuild path.
- Simple result-update/catch-up architecture documented before implementation.
- Mobile-first dashboard UX direction.

## Out Of Scope

- Login
- Prediction editing
- User registration
- Admin approval
- Excel upload inside app
- Manual prediction forms
- Deadline UX
- Payment tracking
- Private user sessions
- In-browser leaderboard calculation
