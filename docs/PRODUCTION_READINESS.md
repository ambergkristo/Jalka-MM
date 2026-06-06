# Production Readiness

This audit covers the current MM 2026 Tournament & Prediction Tracker state before Sprint 21 production work. The app is public, read-only, mock-provider safe by default, and designed to expose confirmed tournament state only.

## 1. Current Readiness Status

| Area | Status | Notes |
| --- | --- | --- |
| Public read-only UI | Ready | Login, registration, admin, prediction submission, and deadline UX are removed from active routes. |
| Public dashboard APIs | Ready | `/api/public-dashboard`, `/api/results`, `/api/leaderboard`, and `/api/tournament` expose public state. |
| Confirmed-results-only policy | Ready | Public final scores and leaderboard rebuilds require `CONFIRMED_FINAL`. |
| Match result persistence | Needs configuration | Tables and repositories exist. Production must use Postgres with persistent backups. |
| Render deployment | Needs configuration | Existing Render URL can stay in use. Production env must be configured explicitly. |
| Result-agent mock mode | Ready | Mock mode is default and safe for local/manual testing. |
| Result-agent live mode | Needs configuration | Requires provider credentials, fixture mapping, and `RESULTS_AGENT_SECRET`. |
| Provider chain | Needs configuration | API-Football and football-data.org skeletons exist but must be verified with real accounts. |
| Final prediction data | Needs final data | Current import is a 24-player working import. Final 50+ player Excel still needs import. |
| Playoff bracket gate | Ready | Public bracket stays placeholder-only until qualifier resolver supplies confirmed teams. |
| Qualifier resolver | Release blocker before knockouts | Automatic group-to-playoff progression and best-third-place logic are deferred. |
| Manual result correction | Risk | Model supports future manual confirmation concept, but no operator UI/tool exists yet. |
| Mobile usability | Needs final smoke test | Recent mobile/layout fixes are in place; final device pass is still required. |

## 2. Required Render Environment Variables

Core app and persistence:

```bash
APP_ENV=production
PUBLIC_APP_BASE_URL=https://jalka-mm.onrender.com
DATABASE_MODE=postgres
DATABASE_URL=<render-postgres-url>
TOURNAMENT_DATA_MODE=partial_official
```

Local SQLite is development-only. In production, `APP_ENV=production` refuses SQLite unless `ALLOW_UNSAFE_PRODUCTION_SQLITE=true`; do not use that override for the public tournament.

Result agent:

```bash
RESULTS_PROVIDER=mock
RESULTS_PROVIDER_CHAIN=mock
RESULTS_WRITE_MODE=mock
RESULTS_AGENT_SECRET=<long-random-secret-before-live-mode>
RESULT_CONFIRMATION_DELAY_MINUTES=10
```

Safe defaults:

- `RESULTS_PROVIDER` defaults to `mock`.
- `RESULTS_PROVIDER_CHAIN` defaults to the selected provider, so the default chain is `mock`.
- `RESULTS_WRITE_MODE` defaults to `mock`.
- `RESULTS_WRITE_MODE=live` requires `RESULTS_AGENT_SECRET`.
- Live runs require request header `x-results-agent-secret: <RESULTS_AGENT_SECRET>`.
- Dry-run can fetch provider data without persisting match results or leaderboard rows.
- No API keys or secrets are committed.

API-Football / API-Sports:

```bash
API_FOOTBALL_API_KEY=
API_FOOTBALL_API_BASE_URL=https://v3.football.api-sports.io
API_FOOTBALL_HOST=v3.football.api-sports.io
API_FOOTBALL_COMPETITION_ID=world-cup
API_FOOTBALL_SEASON=2026
```

football-data.org:

```bash
FOOTBALL_DATA_API_KEY=
FOOTBALL_DATA_API_BASE_URL=https://api.football-data.org/v4
FOOTBALL_DATA_COMPETITION_ID=WC
FOOTBALL_DATA_SEASON=2026
```

Sportmonks optional paid fallback:

```bash
SPORTMONKS_API_KEY=
SPORTMONKS_API_BASE_URL=https://api.sportmonks.com
SPORTMONKS_COMPETITION_ID=732
SPORTMONKS_SEASON=2026
```

Backward-compatible generic provider variables remain supported by selected single-provider adapters:

```bash
RESULTS_API_KEY=
RESULTS_API_BASE_URL=
RESULTS_COMPETITION_ID=
RESULTS_SEASON=
```

## 3. Pre-Release Command Checklist

Run these commands before a release candidate:

```bash
npm run build
npm run validate:prediction-seeds
npm run validate:tournament-data
npm run audit:tournament-data
npm run validate:provider-match-map
npm run simulate:reset
npm run simulate:matchday1
npm run simulate:matchday1:disagreement
npm run simulate:reset
```

Run when final Excel is available:

```bash
npm run import:excel-seeds
npm run validate:prediction-seeds
```

Run for DB readiness:

```bash
npm run db:migrate
```

Run manually for keepalive verification:

```bash
npm run ping:render
```

## 4. Public Route Smoke Checklist

Check these routes on mobile and desktop:

### `/`

- Opening/upcoming matches are visible with date and time.
- Latest results show `Lõppenud mänge veel ei ole.` before confirmed results.
- Leaderboard preview is all-zero before confirmed results.
- No `Alagruppide liidrid` block on the landing page.
- No internal provider/data status text is visible.

### `/results`

- Upcoming matches render cleanly.
- Match cards show date/time without overflow.
- Flags and team names are aligned.
- No fake finished scores appear before confirmed results.
- Empty state is Estonian and clear.

### `/leaderboard`

- Before confirmed results, every player has 0 points, 0 exact scores, 0 correct results, and 0% hit rate.
- After confirmed simulation, persisted recalculated rows are shown.
- After reset, the leaderboard returns to all-zero public state.

### `/player/kristo-amberg`

- Player profile renders without login.
- Prediction sections are read-only.
- Predicted top scorer team/country resolves when known.
- Missing prediction data uses clear empty states.

### `/tournament`

- Page starts with `Alagrupitabelid`; no redundant top summary/progress block.
- Group tables show current public standings.
- Playoff bracket shows placeholders only before qualifiers are resolved.
- No pre-filled knockout countries, flags, fake scores, or `Lõppenud` states appear before confirmed knockout results.
- Top scorers are empty before real/simulated confirmed scorer data.

### `/not-found`

- 404 route renders cleanly and remains public/read-only.

## 5. Simulation Acceptance Checklist

After:

```bash
npm run simulate:reset
```

Expected:

- Latest results are empty.
- Leaderboard is all zero.
- Upcoming games are visible with dates.
- No fake finished scores are public.
- Playoff bracket is placeholder-only.
- Top scorers are empty.

After:

```bash
npm run simulate:matchday1
```

Expected:

- Three confirmed latest results are visible.
- Leaderboard is recalculated and persisted.
- Group A and B standings update.
- Simulated top scorers appear.
- Playoff bracket remains placeholder-only because group stage is incomplete.

After:

```bash
npm run simulate:reset
```

Expected:

- Public state returns to pre-result mode.
- Confirmed latest results disappear.
- Leaderboard returns to all zero.

## 6. Result-Agent Release Checklist

Mock mode:

- `RESULTS_PROVIDER=mock`
- `RESULTS_PROVIDER_CHAIN=mock`
- `RESULTS_WRITE_MODE=mock`
- Safe for local/manual development.

Dry-run mode:

- Use real provider credentials only in server environment.
- Set `RESULTS_WRITE_MODE=dry-run`.
- Verify provider responses, status normalization, request volume, and fixture mapping.
- Dry-run must not persist match results or leaderboard rows.

Live mode:

- Set `RESULTS_WRITE_MODE=live`.
- Configure `RESULTS_AGENT_SECRET`.
- Call `POST /api/results-agent/run` with `x-results-agent-secret`.
- Do not enable live mode until provider dry-run and fixture mapping pass.

Confirmed-results-only policy:

- Two independent providers agreeing on final score can confirm immediately.
- One provider final score is provisional until the same provider repeats the same score after `RESULT_CONFIRMATION_DELAY_MINUTES`.
- Provider disagreement becomes `NEEDS_REVIEW`.
- Public UI does not expose provisional final scores as official final scores.
- Leaderboard rebuilds only after confirmed final results.

## 7. Provider Readiness

Recommended provider strategy:

1. API-Football / API-Sports as primary free/low-cost candidate.
2. football-data.org as secondary verifier.
3. Manual/open-data fallback as operational backup, with no uncontrolled scraping.
4. Sportmonks as optional paid/premium fallback.

Current status:

- Provider adapters and provider chain scaffolding exist.
- Mock remains the default.
- No real provider credentials are committed.
- Tests use mocked network responses only.
- Real 2026 World Cup coverage, pricing, quota, delay behavior, and display rights must be verified before production.
- Provider fixture mapping must be completed and validated before live writes.
- Free-tier request/rate-limit risk remains material, especially on opening day and knockout days.

Do not enable live provider writes before:

- provider account coverage is verified
- fixture IDs are mapped
- `npm run validate:provider-match-map` passes
- dry-run confirms payload shape and status mapping
- `RESULTS_AGENT_SECRET` is configured

## 8. Final Excel Workflow

Current state:

- Import workflow exists and supports the current working Excel structure.
- Current imported real player set has 24 players.
- About 50+ final players are expected later.
- Excel is never uploaded or parsed at runtime.
- Public seed files must not expose email addresses.

Developer import flow:

```text
Excel
-> import script
-> JSON seed files
-> PredictionRepository
-> Application/API
```

Commands:

```bash
npm run import:excel-seeds
npm run validate:prediction-seeds
npm run build
```

Release rule:

- Public leaderboard must remain all-zero before confirmed final results, even if imported Excel/seed files contain historical/import points.

## 9. Known Release Blockers

Release blockers before public production launch:

- Final Excel with all 50+ players has not been imported.
- Production Render environment is not fully configured with `APP_ENV=production`, Postgres, and required secrets.
- Real provider credentials are not configured.
- Real provider fixture mapping is not verified.
- Provider dry-run has not been tested against real accounts.

Release blockers before knockout stage:

- Qualifier resolver / group-to-playoff progression is still deferred.
- The bracket supports placeholders and explicit resolved slots, but does not automatically determine all 1/16-final teams from completed group standings and best third-place logic.
- Full official group tie-break logic is not implemented.

Operational blockers before live result automation:

- Manual correction/fallback flow is not implemented as an operator tool.
- Provider disagreement handling stores `NEEDS_REVIEW`, but resolution still requires future manual workflow.
- Real top scorer/event ingestion is not connected to a provider.

## 10. Known Acceptable Limitations

Acceptable before tournament start:

- Playoff bracket remains placeholder-only.
- Provider chain remains in mock/dry-run mode.
- Top scorers are empty until confirmed scorer data exists.
- Manual result correction is documented but not UI-based.
- Final UI smoke testing on real mobile devices remains a release task.

Not acceptable before tournament start:

- Public fake finished results.
- Public non-zero leaderboard before confirmed results.
- Public exposure of API keys, provider raw payloads, or internal status text.
- Production SQLite without an explicit risk decision.

Not acceptable before knockouts:

- Missing qualifier resolver.
- Missing best-third-place logic.
- Missing confirmed knockout fixture/slot mapping.

## 11. Rollback / Recovery

Return to safe mock mode:

```bash
RESULTS_PROVIDER=mock
RESULTS_PROVIDER_CHAIN=mock
RESULTS_WRITE_MODE=mock
```

Disable live writes:

- Set `RESULTS_WRITE_MODE=mock` or `RESULTS_WRITE_MODE=dry-run`.
- Remove or rotate `RESULTS_AGENT_SECRET` if it may be exposed.
- Do not schedule authenticated live result-agent calls.

Reset simulation data:

```bash
npm run simulate:reset
```

Keep public app read-only:

- Do not add login, admin upload, prediction forms, or runtime Excel parsing.
- Keep provider calls server-side only.
- Keep `.env` and provider credentials out of git.

If provider results disagree:

- Result becomes `NEEDS_REVIEW`.
- Do not rebuild leaderboard.
- Keep public result in confirming/review state.
- Use a future manual/operator fallback to confirm the correct result.

## 12. Next Sprint Recommendation

Recommended next sprint order:

1. Final Excel import when final workbook arrives.
2. Real provider dry-run / credential test.
3. Manual result correction and audit fallback.
4. Qualifier resolver / group-to-playoff progression.
5. Final production Render env and smoke test.

Do not start live provider writes until the first three items are complete and verified.
