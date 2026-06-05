# Render Keepalive Agent

- [x] Add dependency-free ping script for `https://jalka-mm.onrender.com`.
- [x] Add scheduled GitHub Actions workflow with a 14-minute cadence.
- [x] Add manual npm script for immediate/local ping checks.
- [x] Document reliability caveat for GitHub scheduled workflows.
- [x] Run validation commands.
- [x] Commit, push, and verify `HEAD == origin/main`.

## Review

- The workflow has no end date and runs on the default branch schedule.
- GitHub Actions scheduling is best-effort and can be delayed; paid Render always-on hosting is the only strict guarantee against hibernation.
- Validation passed: `npm run ping:render`, `npm test`, `npm run build`, `npm run validate:prediction-seeds`, `npm run validate:tournament-data`, and `npm run audit:tournament-data`.
- Git publication completed after verification.
