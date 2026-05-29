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
- Dark, mobile-first match prediction screen with grouped stages, seeded national team names, country codes, and emoji flags.

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

## Demo Access

- Player invite code: `FRIENDS2026`
- Admin PIN: `ADMIN2026`

## Architecture

- `src/domain`: pure TypeScript tournament data and scoring logic. No React, HTTP, or database dependencies.
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

## Seeded Teams And Schedule

Teams are seeded from `src/domain/teams.ts`. Each seeded team has a display name, short code, emoji flag, and group assignment. The seed uses real national-team names for a realistic private-league demo, but it is still seeded data and should be reviewed against the final official tournament field before production use.

The match seed keeps the 104-match shape: 72 group matches and 32 knockout matches. Group-stage matches use team IDs from the central registry. Knockout matches use clear bracket slot labels such as `Winner Group A` or `Winner R32 Match 73` because exact knockout teams depend on progression.

Dates are seeded as ISO timestamps. The UI formats valid dates and shows `Date TBC` if a date is missing or invalid, so broken labels like `Invalid Date` should not appear.

## Score Explanations

Open the Leaderboard tab and choose Details for a participant, or open the Details tab for the current player. The detail view reads `score_breakdowns` through `/api/breakdown` and displays match and bonus explanation labels such as `6p: exact score correct` or `4p: correct result and goal difference`.

## External Result Providers

`src/server/providers.ts` defines `ManualResultProvider`, `ExternalFootballResultProvider`, and `NormalizedMatchResult`.

The app is fully functional with manual admin updates. Future adapters for API-Football, football-data.org, SportMonks, or LiveScore API should implement `ExternalFootballResultProvider` and return normalized match results. API key placeholders are documented in that file but are not required for the MVP.

## Known Limitations

- Seeded teams are realistic national teams, not a verified final official 2026 field.
- Knockout bracket slots are structurally seeded, not connected to an automatic bracket progression engine.
- External live-score providers are not implemented yet.
- Authentication is simple invite-code/PIN based for private league MVP use.
- Node prints an experimental warning for built-in SQLite on Node 24.

## Git Status

The project repository is `https://github.com/ambergkristo/Jalka-MM` on branch `main`.

## Reference Files

`Juhend 2026.pdf` and `Ennustus 2026.xlsx` were found in `C:\Users\Kasutaja\Documents\Jalka MM APP` and used as product references for scoring categories, prediction coverage, and tournament structure. The app does not copy spreadsheet formulas, templates, branding, or UI, and has no runtime dependency on those files.
