# Sprint 9 - Estonian UI Cleanup

- [x] Read UI/UX, masterplan, sprint, data model, route pages, components, and flag utilities.
- [x] Remove public data/API status strip.
- [x] Remove public marketing/status copy blocks.
- [x] Translate visible public UI copy to Estonian.
- [x] Add flags to match cards, result cards, knockout cards, group leaders, group standings, and top scorers.
- [x] Polish compact text layout for match cards, group tables, top scorers, and tournament stats.
- [x] Document Estonian UI and no-public-debug-status rules.
- [x] Run full verification commands.
- [x] Commit, push, and verify `HEAD == origin/main`.

## Review

- Public UI must stay Estonian.
- Internal status/debug labels belong in APIs, logs, or docs, not public pages.
- True left/right playoff bracket tree remains deferred to Sprint 10.
- Verification passed: `npm test`, `npm run build`, `npm run validate:prediction-seeds`, `npm run validate:tournament-data`, `npm run audit:tournament-data`, and production preview route smoke checks.
- Tournament data audit still reports the existing terminal-only `partial_official` medium-risk warning for unresolved knockout dates and slots.
- Git publication completed after verification.
