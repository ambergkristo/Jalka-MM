# Sprint 6 - Prediction Seed Architecture

- [x] Read product, data model, and sprint docs.
- [x] Add dedicated player and prediction seed files.
- [x] Add strongly typed prediction models.
- [x] Add prediction repository abstraction.
- [x] Add seed loading, normalization, and validation helpers.
- [x] Move leaderboard and player profile data out of client mock arrays.
- [x] Migrate landing leaderboard preview through repository.
- [x] Migrate leaderboard page through repository.
- [x] Migrate player profile page through repository.
- [x] Add meaningful empty states for missing seed data.
- [x] Add prediction seed validation tests.
- [x] Run full verification commands.

## Review

- Sprint scope is prediction seed architecture only; Excel import and admin tools were not implemented.
- Prediction data now loads from `src/data/` through `src/domain/predictionRepository.ts`.
- Tournament Center mock data remains in `src/client/data/mock.ts` by design for this sprint.
- Verification passed: `npm test`, `npm run build`, `npm run validate:tournament-data`, `npm run audit:tournament-data`, and built-server smoke checks for `/leaderboard` and `/player/argo`.
- Tournament data audit still reports existing `partial_official` status with medium risk because knockout fixture dates and slots remain unresolved.
