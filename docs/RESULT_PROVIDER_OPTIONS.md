# Result Provider Options

Sprint 17 changes the provider strategy from "Sportmonks first" to a free/low-cost multi-provider chain. Mock remains the default. Real providers stay disabled unless explicitly configured.

## Recommendation

Recommended production order:

1. **API-Football / API-Sports** as the preferred low-cost primary live-score candidate.
2. **football-data.org** as a low-cost secondary verifier, especially for final-score confirmation.
3. **Manual/open-data fallback** as an operational backup path, with no uncontrolled scraping.
4. **Sportmonks** as an optional paid/premium fallback. The existing Sportmonks adapter remains available.

Before production, verify exact 2026 World Cup coverage, fixture ids, rate limits, plan terms, and display rights in the chosen provider accounts. Do not treat current pricing or coverage notes as locked facts.

## Provider Comparison

| Provider | Expected role | Cost/free-tier posture | Live vs delayed behavior | Key risks | Integration complexity |
| --- | --- | --- | --- | --- | --- |
| API-Football / API-Sports | Primary live-score candidate | Low-cost/free-tier candidate; daily request budget must be verified before tournament | Likely best fit for live status and score polling among low-cost candidates | Free quota may be too small for full tournament polling; World Cup 2026 fixture availability must be verified | Medium |
| football-data.org | Secondary verifier | Free/low-cost candidate; request limits and delayed data rules must be verified | Useful for delayed/final score checks; not assumed to be primary live source | 2026 World Cup coverage, live tier, and delay behavior must be verified | Low |
| Manual/open-data fallback | Operational backup and future manual confirmation | No provider cost, but requires operator workflow | Used only for manual confirmation or static/open-data import; no scraping | Needs careful audit trail and admin tooling in a later sprint | Medium |
| Sportmonks | Optional paid/premium fallback | Paid/premium option | Strong candidate if low-cost sources are insufficient | Higher cost; payload complexity; account-specific limits | Medium-high |

## Sprint 17 Implementation

Implemented now:

- `src/server/results/apiFootballResultProvider.ts`
- `src/server/results/footballDataResultProvider.ts`
- `src/server/results/providerChainResultProvider.ts`
- provider-specific env config for API-Football, football-data.org, and Sportmonks
- provider-chain factory support with mock default
- chain observations passed into the confirmed-results consensus engine

The chain does not enable real providers by default and tests use mocked network only.

## Request Budget Strategy

The result agent should avoid wasting free-tier requests:

- Mock remains default for local development.
- A configured chain asks the primary provider first.
- Verifier providers are queried only when the primary provider returns a final score or the stored match state needs confirmation/review.
- Secondary providers are not polled for every scheduled/live match.
- Dry-run mode should be used before live writes.

This is intentionally conservative. Sprint 18 or later can refine polling windows after the real provider plan and quota are known.

## Required Fields

The app needs only a small provider subset:

- provider fixture id
- kickoff UTC
- home and away team identifiers/names
- normalized status
- home and away score
- minute
- extra-time or penalty state when available
- raw provider status
- provider last update timestamp

Events, lineups, standings, and rich statistics remain out of scope for result confirmation unless needed for status/score interpretation.

## Production Checklist

- Verify provider account coverage for all 104 World Cup 2026 fixtures.
- Verify group-stage and knockout fixture ids are available and stable.
- Complete provider fixture mapping with `confidence: "confirmed"`.
- Run provider chain in `RESULTS_WRITE_MODE=dry-run`.
- Confirm status mappings for FT, AET, penalties, postponed, and suspended states.
- Confirm rate limits under opening-day and knockout-day polling.
- Confirm provider terms allow display in a private prediction-league dashboard.
- Configure `RESULTS_AGENT_SECRET` before live writes.
- Keep API keys out of git and out of public frontend code.

## Sources Checked

- API-Football pricing and documentation: `https://www.api-football.com/pricing`, `https://www.api-football.com/documentation-v3`, checked June 6, 2026.
- football-data.org pricing, API reference, and policies: `https://www.football-data.org/pricing`, `https://www.football-data.org/documentation/api`, `https://docs.football-data.org/general/v4/policies.html`, checked June 6, 2026.
- Sportmonks pricing and docs: `https://www.sportmonks.com/football-api/world-plan/`, `https://docs.sportmonks.com/football`, checked June 6, 2026.
