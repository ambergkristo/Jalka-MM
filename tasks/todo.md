# Sprint 8 - Excel Seed Import

- [x] Read masterplan, data model, sprint plan, scoring rules, repository, points engine, and current seeds.
- [x] Locate workbook and copy the provided `data.xlsx` to `imports/data.xlsx` for import.
- [x] Keep Excel workbooks out of git.
- [x] Add repeatable Excel-to-seed import script.
- [x] Add stable player id generation.
- [x] Generate public player, match prediction, group prediction, knockout prediction, awards prediction, and leaderboard seed files.
- [x] Generate an import report.
- [x] Add prediction seed validation command.
- [x] Update repository/view-model tests for imported players.
- [x] Document Excel import workflow and current mapping.
- [x] Run full verification commands.
- [x] Commit, push, and verify `HEAD == origin/main`.

## Review

- Imported only players with matching numbered individual prediction sheets.
- Source email addresses are omitted from public seed files and checked by validation.
- Best Player and bonus scoring remain deferred because current public domain models do not support them yet.
- Verification passed: `npm run import:excel-seeds`, `npm run validate:prediction-seeds`, `npm test`, `npm run build`, `npm run validate:tournament-data`, and `npm run audit:tournament-data`.
- Tournament data audit still reports the existing `partial_official` medium-risk warning for unresolved knockout dates and slots.
- Git publication completed after verification.
