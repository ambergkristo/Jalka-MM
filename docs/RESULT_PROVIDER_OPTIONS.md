# Result Provider Options

Sprint 11 compared provider options. Sprint 14 implements the first real adapter behind the existing provider abstraction without enabling live credentials by default.

## Recommendation

Implementation target for Sprint 14: **Sportmonks**.

Sportmonks was selected because its public documentation has explicit World Cup 2026 livescore guidance and a tournament-specific league filter. Backup candidate: **API-Football / API-Sports** because it is cheaper and broad, but fixture mapping and 2026 World Cup season availability must be verified in an account. **football-data.org** is attractive for simplicity, but the exact 2026 World Cup coverage and live data tier should be confirmed before relying on it.

Before live tournament use, create a Sportmonks account, fetch the fixture list, map all internal matches, and verify status/score updates on a live or recently completed competition.

## Provider Comparison

| Provider | 2026 World Cup coverage | Fixture/live endpoints | Quota/cost concerns | Data needed | Risk | Complexity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| API-Football / API-Sports | Coverage page lists World Cup under international/world competitions, but season-specific 2026 fixture availability must be verified. | Pricing page includes Fixtures, Livescore, Events, Statistics, and Top Scorers across plans. | Free plan is 100 requests/day; paid plans list 7,500+/day. Polling every active match should fit paid tiers, but free is too small for tournament use. | Fixture id, league/season id, kickoff UTC, teams, status, score, minute, events if later needed. | Medium | Medium | Good low-cost candidate. Needs account-level fixture-id verification and provider status mapping. |
| football-data.org | API docs list World Cup as competition code `WC` historically; current 2026 availability and included live scoring tier must be verified. | Competition matches, match resource, status, score, minute, lastUpdated, scorers depending on plan. | Free plan has delayed scores and 10 calls/min; live scores start at paid tiers. Higher tiers add lineups/scorers and higher limits. | Match id, competition code/id, season, utcDate, status, score, minute, lastUpdated. | Medium-high | Low | Clean model and simple status vocabulary. Risk is coverage/tier fit for World Cup 2026. |
| Sportmonks | Public docs have a World Cup 2026 section and reference live World Cup fixture filtering. | Livescore endpoints include in-play, all livescores, and latest-updated livescores; fixture endpoints also exist. | Plans are more expensive than API-Football. Pricing lists per-entity hourly call limits and World Cup widget/API offerings. | Fixture id, league id, season, participants, scores, state, periods, updated_at. | Low-medium | Medium-high | Selected Sprint 14 adapter target. More complex payloads and higher cost. |

## Sprint 14 Implementation Target

Implemented adapter:

- `src/server/results/sportmonksResultProvider.ts`

Supported now:

- fixture-id based lookup through provider match map
- Sportmonks fixture fetch using native `fetch`
- status normalization into internal match statuses
- home/away score extraction from score rows
- minute extraction when exposed
- provider update timestamp preservation
- safe warning and skipped network call when fixture mapping is missing

Still required before live use:

- set real `RESULTS_API_KEY` outside the repository
- set `RESULTS_PROVIDER=sportmonks`
- set `RESULTS_API_BASE_URL=https://api.sportmonks.com`
- set `RESULTS_COMPETITION_ID` and `RESULTS_SEASON`
- use `RESULTS_WRITE_MODE=dry-run` for provider response checks before writes
- complete confirmed provider fixture mapping
- protect write automation with `RESULTS_AGENT_SECRET`

## Required Fields

The app needs only a small provider subset for MVP:

- provider fixture id
- kickoff UTC
- home and away team identifiers/names
- normalized status
- home and away score
- minute
- extra-time or penalty state when available
- raw provider status
- provider last update timestamp

Events, lineups, standings, and rich statistics are out of scope for the first live result integration unless the chosen provider makes them necessary for score/status interpretation.

## Open Verification Items

- Confirm the selected provider has all 104 World Cup 2026 fixtures available before kickoff.
- Confirm group-stage fixture ids remain stable after team qualification/slot resolution.
- Confirm knockout fixture ids are available before teams are known.
- Confirm how extra time and penalties are represented.
- Confirm rate limits under tournament-day polling.
- Confirm provider terms allow public dashboard display for a private prediction league.
- Confirm whether top scorer data is included in the selected tier.

## Sources Checked

- API-Football pricing and coverage pages: `https://www.api-football.com/pricing`, `https://www.api-football.com/coverage`, checked June 5, 2026.
- API-Football documentation: `https://www.api-football.com/documentation-v3`, checked June 5, 2026.
- football-data.org pricing and API reference: `https://www.football-data.org/pricing`, `https://www.football-data.org/documentation/api`, checked June 5, 2026.
- Sportmonks pricing and World Cup 2026 livescore docs: `https://www.sportmonks.com/football-api/pricing/`, `https://docs.sportmonks.com/football/tutorials-and-guides/tutorials/world-cup-2026/livescores`, checked June 5, 2026.
