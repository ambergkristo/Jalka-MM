# World Cup 2026 Friends Predictor

Mobile-first PWA MVP for a private World Cup prediction league. It is isolated from the existing FUTU booking app in this repository.

## Run Locally

```bash
cd worldcup2026
npm install
npm test
npm run build
npm run seed
npm run dev
```

Open `http://localhost:5174`. The API runs on `http://localhost:8787`.

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

Use `ADMIN2026`, open the Admin tab, enter results, lock/unlock predictions, and trigger recalculation. Every result, deadline, and bonus-result change is written to `admin_audit_log`.

## External Result Providers

`src/server/providers.ts` defines `ManualResultProvider`, `ExternalFootballResultProvider`, and `NormalizedMatchResult`.

The app is fully functional with manual admin updates. Future adapters for API-Football, football-data.org, SportMonks, or LiveScore API should implement `ExternalFootballResultProvider` and return normalized match results. API key placeholders are documented in that file but are not required for the MVP.

## Reference Files

`Juhend 2026.pdf` and `Ennustus 2026.xlsx` were found in `C:\Users\Kasutaja\Documents\Jalka MM APP` and used as product references for scoring categories, prediction coverage, and tournament structure. The app does not copy spreadsheet formulas, templates, branding, or UI, and has no runtime dependency on those files.
