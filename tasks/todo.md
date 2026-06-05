# Public Pre-Tournament Dashboard Cleanup

- [x] Inspect landing dashboard, results page, group leader cards, and public mock data.
- [x] Remove fake latest result data from public dashboard/results views.
- [x] Add pre-tournament opening matchday fixture selection from 11 June 2026 schedule.
- [x] Add empty state for confirmed latest results.
- [x] Make group leader cards clickable tournament/group shortcuts.
- [x] Add group anchors in Tournament Center.
- [x] Add targeted public dashboard data and render tests.
- [x] Run `npm run build`.
- [x] Run targeted tests.
- [x] Commit, push, and verify `HEAD == origin/main`.

## Review

- Build passed: `npm run build`.
- Targeted tests passed: `npx vitest run src/test/publicDashboardData.test.ts src/test/publicDashboardPages.test.tsx src/test/resultConsensus.test.ts`.
- Vite still reports a chunk-size warning after successful build; no functional failure.
- Git publication completed after verification.
