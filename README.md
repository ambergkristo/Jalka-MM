# World Cup 2026 Friends Predictor

Mobile-first PWA MVP for a private World Cup prediction league.

## Current Features

- Player login with name and invite code/PIN.
- Mobile match prediction entry for all 104 seeded World Cup 2026-shaped matches.
- Bonus prediction flow for group winners, group second places, group qualifiers, knockout round participants, third-place winner, champion, and top scorer.
- Admin match result entry.
- Admin bonus-result entry, including multiple tied top scorers.
- Admin lock/unlock and deadline configuration.
- Real leaderboard calculated from stored predictions, results, and score breakdowns.
- Participant score detail view with match and bonus explanations.
- Manual result provider boundary for future live-score integrations.
- Dark, mobile-first match prediction screen with grouped stages, neutral seeded team slots, codes, and flag placeholders.
- Tournament data source layer with explicit verification status and validation.
- Bracket slot/progression and basic group standings domain foundations.

## Run Locally

```bash
cd "C:\Users\Kasutaja\Documents\Jalka MM APP"
npm install
npm test
npm run build
npm run seed
npm run dev
```

Open `http://localhost:5174`. The API runs on `http://localhost:8787`.

Commands:

- `npm install`: install dependencies
- `npm test`: run pure scoring tests and SQLite stored-data tests
- `npm run build`: compile the API and build the PWA
- `npm run seed`: create/update the local SQLite demo data
- `npm run dev`: run API and Vite dev server
- `npm run validate:tournament-data`: validate tournament JSON source files

## Demo Access

- Player invite code: `FRIENDS2026`
- Admin PIN: `ADMIN2026`

## Architecture

- `src/domain`: pure TypeScript tournament data and scoring logic. No React, HTTP, or database dependencies.
- `src/data/worldcup2026`: JSON source files for tournament metadata, teams, groups, matches, and bracket slots.
- `src/server`: Node TypeScript API using built-in SQLite (`node:sqlite`) and a manual result provider boundary.
- `src/client`: React + Vite PWA UI for prediction entry, leaderboard, and admin result entry.
- `data/worldcup2026.sqlite`: local SQLite database created at runtime.

The database schema includes `users`, `players`, `competitions`, `teams`, `groups`, `matches`, `predictions`, `prediction_submissions`, `actual_results`, `bonus_predictions`, `bonus_results`, `score_breakdowns`, `leaderboard_snapshots`, and `admin_audit_log`.

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

Knockout match score points are based on the home-away bracket slot score. Team identity is handled by bonus/progression scoring.

## Admin Flow

Use `ADMIN2026`, open the Admin tab, enter match results, edit the prediction deadline, lock/unlock predictions, enter bonus results, and trigger recalculation. Every result, deadline, and bonus-result change is written to `admin_audit_log`.

## Bonus Prediction Flow

Use the Bonus tab as a player. Select each group winner, group second place, and two qualifiers. Then select teams reaching Round of 16, quarter-finals, semi-finals, and the final, plus the third-place winner, champion, and top scorer. The screen shows how many required fields are still missing and saves through the API to `bonus_predictions`.

## Admin Bonus Results

Use the Admin tab. Enter final group outcomes, knockout round participants, third-place winner, champion, and top scorer results. Multiple tied top scorers can be entered separated by commas or new lines. Saving bonus results writes to `bonus_results` and recalculates score breakdowns.

## Tournament Data Source

Tournament source files live in `src/data/worldcup2026`:

- `metadata.json`: source name/reference, retrieved timestamp, and `verificationStatus`
- `teams.json`: 48 team or slot records
- `groups.json`: 12 group records
- `matches.json`: 104 matches
- `bracket.json`: knockout slot placeholders

Current `verificationStatus` is `seeded`. The seeded data is intentionally neutral: group-stage fixtures use labels such as `Group A Team 1 vs Group A Team 2`, not unverified real-country matchups. Replace these JSON files with verified official data before live competition use, then run:

```bash
npm run validate:tournament-data
```

Validation checks team/group/match counts, duplicate match numbers, invalid team and group references, date validity/TBC handling, and required verification status.

The match seed keeps the 104-match shape: 72 group matches and 32 knockout matches. Group-stage matches use neutral team IDs from the JSON registry. Knockout matches use clear bracket slot labels such as `Winner Group A`, `3rd Group C/D/E`, or `Winner Match 73` because exact knockout teams depend on progression.

Dates are seeded as ISO timestamps. The UI formats valid dates and shows `Date TBC` if a date is missing or invalid, so broken labels like `Invalid Date` should not appear.

## Bracket And Standings Foundations

`src/domain/bracket.ts` formats and resolves bracket slots for concrete teams, group winners, group runner-ups, best-third placeholders, previous-match winners, and previous-match losers.

`src/domain/standings.ts` calculates basic group standings: played, wins, draws, losses, goals for, goals against, goal difference, and points. Sorting currently uses points, goal difference, and goals for. Full official tie-break rules are intentionally not claimed yet.

## Score Explanations

Open the Leaderboard tab and choose Details for a participant, or open the Details tab for the current player. The detail view reads `score_breakdowns` through `/api/breakdown` and displays match and bonus explanation labels such as `6p: exact score correct` or `4p: correct result and goal difference`.

## External Result Providers

`src/server/providers.ts` defines `ManualResultProvider`, `ExternalFootballResultProvider`, and `NormalizedMatchResult`.

The app is fully functional with manual admin updates. Future adapters for API-Football, football-data.org, SportMonks, or LiveScore API should implement `ExternalFootballResultProvider` and return normalized match results. API key placeholders are documented in that file but are not required for the MVP.

## Known Limitations

- Current tournament data is seeded and neutral, not verified official World Cup 2026 data.
- Full official FIFA tie-break rules are not complete.
- Knockout best-third-place mapping still requires verified official mapping.
- Knockout bracket slots are structurally seeded; automatic bracket progression is only foundational.
- External live-score providers are not implemented yet.
- Authentication is simple invite-code/PIN based for private league MVP use.
- Node prints an experimental warning for built-in SQLite on Node 24.

## Git Status

The project repository is `https://github.com/ambergkristo/Jalka-MM` on branch `main`.

## Reference Files

`Juhend 2026.pdf` and `Ennustus 2026.xlsx` were found in `C:\Users\Kasutaja\Documents\Jalka MM APP` and used as product references for scoring categories, prediction coverage, and tournament structure. The app does not copy spreadsheet formulas, templates, branding, or UI, and has no runtime dependency on those files.
