# World Cup 2026 Friends Predictor

Mobile-first PWA MVP for a private World Cup prediction league.

## Current Features

- Player login with name and invite code/PIN.
- Public player registration with optional contact field and pending/approved/disabled approval status.
- Mobile match prediction entry for all 104 World Cup 2026-shaped matches.
- Bonus prediction flow for group winners, group second places, group qualifiers, knockout round participants, third-place winner, champion, and top scorer.
- Admin match result entry.
- Admin bonus-result entry, including multiple tied top scorers.
- Admin lock/unlock and deadline configuration.
- Admin player approval screen. Only approved players appear in the official leaderboard.
- Real leaderboard calculated from stored predictions, results, and score breakdowns.
- Participant score detail view with match and bonus explanations.
- Manual result provider boundary for future live-score integrations.
- Dark, mobile-first match prediction screen with grouped stages, team names, codes, flags, and Estonia-time kickoff display when verified.
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
npm run dev
```

Open `http://localhost:5174`. The API runs on `http://localhost:8787`.

Commands:

- `npm install`: install dependencies
- `npm test`: run pure scoring tests and SQLite stored-data tests
- `npm run build`: compile the API and build the PWA
- `npm run seed`: alias for safe tournament-data update
- `npm run seed:tournament-data`: safely update teams, groups, and matches without deleting players, predictions, or results
- `npm run seed:demo`: destructive local reset followed by demo player seeding
- `npm run reset:dev`: destructive local development wipe
- `npm run dev`: run API and Vite dev server
- `npm run validate:tournament-data`: validate tournament JSON source files
- `npm run audit:tournament-data`: print an operator readiness report for tournament data

## Demo Access

- Player invite code: `FRIENDS2026`
- Admin PIN: `ADMIN2026`

New player registrations start as `pending`. Pending players may enter and save predictions, but they do not appear in the official leaderboard until the admin approves them.

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

Use `ADMIN2026`, open the Admin tab, enter match results, edit the prediction deadline, lock/unlock predictions, enter bonus results, approve/disable players, and trigger recalculation. Every result, deadline, bonus-result, and player-status change is written to `admin_audit_log`.

The admin approval action requires the admin PIN in the admin screen and is enforced by the backend. Normal players do not see the Admin tab, and non-admin approval requests are rejected server-side.

## Public Registration And Approval

The public flow is intentionally simple for a private friends league:

1. Admin shares the app URL.
2. Player registers with name, optional contact, and the league invite code.
3. Player can immediately fill and save match and bonus predictions.
4. Player pays the entry fee outside the app by personal transfer to the admin.
5. Admin confirms payment manually and approves the player in the Admin tab.

The app does not collect money, process card payments, connect to banks, or store payment credentials.

Player statuses:

- `pending`: default for new players; predictions are saved but excluded from the official leaderboard.
- `approved`: included in official leaderboard and ranking.
- `disabled`: excluded from official leaderboard and scoring views.

If a pending player submits predictions before the deadline and is approved later, the original prediction submission timestamp remains the leaderboard tie-break timestamp. Approval time is not used as the tie-breaker.

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

Destructive commands:

- `npm run seed:demo`: wipes local data, then creates demo players.
- `npm run reset:dev`: wipes local development data.

Destructive commands are intentionally explicit and refuse production mode unless `ALLOW_PRODUCTION_RESET=true` is set. For real competition use, back up the SQLite database before updates:

```powershell
Copy-Item .\data\worldcup2026.sqlite ".\data\worldcup2026-backup-$(Get-Date -Format yyyyMMdd-HHmmss).sqlite"
```

Before hosting publicly, replace simple invite-code auth, configure backups, put the API behind HTTPS, set an explicit deployment database path, and avoid treating local SQLite/demo mode as production-safe.

## Tournament Data Source

Tournament source files live in `src/data/worldcup2026`:

- `metadata.json`: source name/reference, retrieved timestamp, and `verificationStatus`
- `teams.json`: 48 team or slot records
- `groups.json`: 12 group records
- `matches.json`: 104 matches
- `bracket.json`: knockout slot placeholders

Current `verificationStatus` is `partial_official`. Official group/team data and part of the FIFA-published group-stage fixture list are encoded, while unresolved kickoff timestamps and some fixtures remain marked as TBC/manual/unknown. Do not invite real players until `npm run audit:tournament-data` shows the remaining gaps are acceptable for your operation.

```bash
npm run validate:tournament-data
npm run audit:tournament-data
```

Validation checks metadata, allowed verification statuses, team/group/match counts, duplicate team IDs, duplicate match numbers, invalid team and group references, date/TBC handling, knockout slot usage, unresolved kickoff-time counts, and required source metadata.

The match seed keeps the 104-match shape: 72 group matches and 32 knockout matches. Group-stage matches use neutral team IDs from the JSON registry. Knockout matches use clear bracket slot labels such as `Winner Group A`, `3rd Group C/D/E`, or `Winner Match 73` because exact knockout teams depend on progression.

Group-stage kickoff times are displayed in Estonia time (`Europe/Tallinn`) as `HH:mm Eesti aeg` when a verified ISO timestamp exists. If the value is unknown or invalid, the app shows `Time TBC`; broken labels like `Invalid Date` should not appear.

## Bracket And Standings Foundations

`src/domain/bracket.ts` formats and resolves bracket slots for concrete teams, group winners, group runner-ups, best-third placeholders, previous-match winners, and previous-match losers.

`src/domain/standings.ts` calculates basic group standings: played, wins, draws, losses, goals for, goals against, goal difference, and points. Sorting currently uses points, goal difference, and goals for. Full official tie-break rules are intentionally not claimed yet.

## Score Explanations

Open the Leaderboard tab and choose Details for a participant, or open the Details tab for the current player. The detail view reads `score_breakdowns` through `/api/breakdown` and displays match and bonus explanation labels such as `6p: exact score correct` or `4p: correct result and goal difference`.

## External Result Providers

`src/server/providers.ts` defines `ManualResultProvider`, `ExternalFootballResultProvider`, and `NormalizedMatchResult`.

The app is fully functional with manual admin updates. Future adapters for API-Football, football-data.org, SportMonks, or LiveScore API should implement `ExternalFootballResultProvider` and return normalized match results. API key placeholders are documented in that file but are not required for the MVP.

## Known Limitations

- Current tournament data is only partially official. Kickoff timestamps still need full official verification.
- Full official FIFA tie-break rules are not complete.
- Knockout best-third-place mapping still requires verified official mapping.
- Knockout bracket slots are structurally seeded; automatic bracket progression is only foundational.
- External live-score providers are not implemented yet.
- Local SQLite mode needs backups and hosting hardening before public production use.
- Authentication is simple invite-code/PIN based for private league MVP use.
- Node prints an experimental warning for built-in SQLite on Node 24.

## Git Status

The project repository is `https://github.com/ambergkristo/Jalka-MM` on branch `main`.

## Reference Files

`Juhend 2026.pdf` and `Ennustus 2026.xlsx` were found in `C:\Users\Kasutaja\Documents\Jalka MM APP` and used as product references for scoring categories, prediction coverage, and tournament structure. The app does not copy spreadsheet formulas, templates, branding, or UI, and has no runtime dependency on those files.
