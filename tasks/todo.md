# Play-off Bracket Mirror Hotfix

- [x] Inspect true bracket components and CSS.
- [x] Fix right-side visual round order without mutating source data.
- [x] Fix right-side connector direction and spacing.
- [x] Preserve mobile contained horizontal scroll behavior.
- [x] Add targeted bracket test coverage.
- [x] Run `npm run build`.
- [x] Run targeted bracket tests.
- [x] Commit, push, and verify `HEAD == origin/main`.

## Review

- Build passed: `npm run build`.
- Targeted tests passed: `npx vitest run src/test/trueBracket.test.tsx src/test/bracket.test.ts`.
- Playwright/browser smoke was not run because Playwright is not installed and no new dependency was needed for this hotfix.
- Git publication completed after verification.
