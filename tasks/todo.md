# Sprint 1 - Repository Reset

- [x] Remove prediction submission UI.
- [x] Remove login and registration UI.
- [x] Remove admin UI.
- [x] Remove deadline and lock UX.
- [x] Remove old submission/auth/admin API handlers.
- [x] Remove tests tied to old submission/auth/admin/deadline flows.
- [x] Add public read-only route skeleton.
- [x] Add landing dashboard placeholder.
- [x] Add leaderboard, player, results, tournament, and not-found placeholders.
- [x] Add basic mobile-first design system.
- [x] Keep tournament data, validation, scoring, standings, bracket, Vite, and deploy foundations.
- [x] Run verification commands.

## Review

- Sprint scope is repository reset and application skeleton.
- Active app is public/read-only with placeholder pages and no submission/auth/admin UI.
- Active API exposes only public state and health endpoints.
- Verification passed: `npm test`, `npm run build`, `npm run validate:tournament-data`, and `npm run audit:tournament-data`.
- Tournament data audit still reports existing `partial_official` status with medium risk because knockout fixture dates and slots remain unresolved.
