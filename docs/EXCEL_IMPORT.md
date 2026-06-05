# Excel Import Workflow

The app does not upload, parse, or store Excel workbooks at runtime. Excel conversion is a developer workflow that turns the current prediction workbook into public JSON seed files.

```text
Excel workbook
-> import script
-> JSON seed files
-> PredictionRepository
-> public application
```

## Source File

Place the workbook at:

```text
imports/data.xlsx
```

The workbook itself is ignored by git because it may contain private registration data such as email addresses.

## Commands

```bash
npm run import:excel-seeds
npm run validate:prediction-seeds
```

The import command builds the server/tooling TypeScript and runs `dist/tools/importExcelSeeds.js`. The validation command verifies the generated public seeds.

## Generated Files

The importer writes:

- `src/data/players.json`
- `src/data/predictions/matchPredictions.json`
- `src/data/predictions/groupPredictions.json`
- `src/data/predictions/knockoutPredictions.json`
- `src/data/predictions/awardsPredictions.json`
- `src/data/predictions/leaderboardSeed.json`
- `imports/import-report.json`

## Current Workbook Mapping

The current test import workbook contains these sheets:

- `actual`
- `stat`
- `data`
- numbered player sheets from `1.ValloPoldma` through `24.Karolin`

The importer uses the `data` sheet for registered player identity rows and imports only rows that have a matching numbered player sheet. This avoids treating future placeholder rows in `data` as public players before their prediction sheets exist.

Discovered mapping:

- `data!A:D`, starting around row 4: player name, location/KOV, email, existing points.
- Player sheet rows `1:72`: match score predictions.
- Player sheet rows `76:87`: group predictions for Groups A-L.
- Player sheet rows `91:106`: Round of 32 predictions.
- Player sheet rows `107:114`: Round of 16 predictions.
- Player sheet rows `115:118`: quarter-final predictions.
- Player sheet rows `119:120`: semi-final predictions.
- Player sheet row `121`: third-place prediction.
- Player sheet row `122`: final prediction.
- Player sheet row `124`: champion prediction.
- Player sheet row `132`: top scorer prediction.

Player ids are generated from names by lowercasing, trimming whitespace, replacing separators with hyphens, removing unsupported punctuation, and appending a numeric suffix for duplicates.

## Privacy

Email addresses are read only to detect source privacy risk. They are not written to `players.json` or any public prediction seed file.

`npm run validate:prediction-seeds` scans public seed files for email-like values and fails if any are found.

## Current Limitations

- The workbook is not the final tournament workbook; more players can be added later.
- Only rows with matching individual player sheets are imported.
- Existing Excel points are imported into `leaderboardSeed.json`; exact-score totals, correct-result totals, and hit rate stay at zero until the app points engine recalculates them from finalized results.
- Best Player is detected in player sheets but deferred because the current public `AwardsPrediction` model does not include it.
- Bonus scoring for group rank, knockout progression, champion, top scorer, and best player remains deferred under the Sprint 7 scoring rules.
- Unknown extra columns in `data` are documented in the import report instead of guessed.

## Repeating the Import

When the final 50+ player workbook is ready:

1. Replace `imports/data.xlsx` with the final workbook.
2. Run `npm run import:excel-seeds`.
3. Review `imports/import-report.json`.
4. Run `npm run validate:prediction-seeds`.
5. Run the full validation suite before committing generated seed changes.
