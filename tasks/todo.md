# Sprint 20.1 - Public UI Cleanup Hotfix

- [x] Remove `/tournament` summary cards and stage progress block.
- [x] Remove landing page group leaders / tournament tables block.
- [x] Tighten match and result card layout for date/time, flags, names, and scores.
- [x] Expand team lookup from tournament seed data and add aliases for missing flags.
- [x] Update targeted public page and flag tests.
- [x] Run `npm run build`.
- [x] Run targeted Vitest tests.
- [x] Commit, push, and verify `HEAD == origin/main`.

## Review

- `npm run build` passed.
- Targeted Vitest tests passed: public dashboard pages, team badge/flags, true bracket.
- `/tournament` now starts with alagrupitabelid instead of the redundant summary/progress block.
- Landing page no longer renders `Alagruppide liidrid`.
- Match/result card grids avoid cramped three-column layouts on mid-width screens.
- Team lookup now resolves current seed teams plus common aliases such as Bosnia, Haiti, Türkiye, Côte d’Ivoire, Cabo Verde, and AÜE.
