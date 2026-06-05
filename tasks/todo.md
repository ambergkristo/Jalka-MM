# Sprint 0 - Architecture Lock

- [x] Rewrite README for the public read-only MM 2026 tracker direction.
- [x] Create product masterplan.
- [x] Document planned data model.
- [x] Document future results agent workflow.
- [x] Document UI/UX direction.
- [x] Document sprint roadmap.
- [x] Audit legacy prediction-submission areas.
- [x] Run existing verification commands.
- [x] Commit and push documentation changes.

## Review

- Sprint scope is documentation only.
- New direction is public/read-only with final predictions sourced from Excel outside the app.
- Prediction submission, login, registration, admin approval, and deadline UX are legacy areas scheduled for Sprint 1 removal.
- Verification passed: `npm test`, `npm run build`, `npm run validate:tournament-data`, and `npm run audit:tournament-data`.
- Tournament data audit still reports existing `partial_official` status with medium risk because knockout fixture dates and slots remain unresolved.
