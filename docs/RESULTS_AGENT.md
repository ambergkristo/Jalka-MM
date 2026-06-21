# Results Agent Plan

The results agent is the backend workflow that updates tournament match statuses and scores. Mock remains the default provider. The free production path is `free-worldcup`: OpenWorldCup acts as the primary live/provisional source, football-data.org free tier can act as a mapped final-score verifier, and operator/manual confirmation remains the fallback. API-Football and Sportmonks adapters remain available for experiments but are not part of the free-only production recommendation. Live use still requires credentials, confirmed fixture mapping where relevant, and endpoint protection. Provider final scores may be stored provisionally, but public final scores and official leaderboard rebuilds require confirmation.

Current implementation modules live in `src/server/results/`:

- `resultTypes.ts`
- `resultProvider.ts`
- `resultProviderConfig.ts`
- `resultProviderFactory.ts`
- `mockResultProvider.ts`
- `apiFootballResultProvider.ts`
- `footballDataResultProvider.ts`
- `sportmonksResultProvider.ts`
- `providerChainResultProvider.ts`
- `providerMatchMap.ts`
- `matchScheduler.ts`
- `resultAgent.ts`
- `leaderboardRebuild.ts`
- `databaseResultRepository.ts`
- `inMemoryResultRepository.ts`
- `leaderboardRepository.ts`
- `resultPersistenceSchema.ts`
- `resultAgentRuntime.ts`
- `resultConsensus.ts`

## Responsibilities

The agent will:

- Fetch match results from a football data API.
- Normalize provider-specific statuses into app statuses.
- Update match statuses and scores in the database.
- Detect provisional and confirmed final results.
- Rebuild and save the leaderboard after confirmed final result changes only.
- Store update metadata for monitoring and recovery.

## Match Statuses

The workflow must handle:

- Scheduled
- Live
- Half-time
- Full-time
- Extra time
- Penalties
- Postponed
- Suspended
- Cancelled, if the provider exposes it

Provider-final result states are not automatically public final results. A provider may report full time, after extra time, or after penalties, but the app keeps that score provisional until the consensus policy confirms it.

Public result statuses are:

- `SCHEDULED` -> Algamas
- `LIVE` -> Käimas
- `CONFIRMING` -> Kinnitamisel
- `CONFIRMED_FINAL` -> Lõppenud
- `NEEDS_REVIEW` -> Kinnitamisel, with internal review metadata

Only `CONFIRMED_FINAL` results expose an official public score and only those results feed the leaderboard rebuild.

## Stored Update Metadata

Each tracked update should store:

- `lastCheckedAt`
- `nextCheckAt`
- `status`
- `publicStatus`
- `isFinal`
- provisional score/status fields
- confirmed score/status fields
- `confirmedAt`
- `confirmationSource`
- `confirmationConfidence`
- `needsReviewReason`
- provider observation history
- `pointsRecalculatedAt`
- provider/source name
- optional raw provider status
- optional error message

Sprint 13 persists this through the database-backed result repository. The database stores current match result state, result update metadata, leaderboard rows, and leaderboard rebuild metadata. `InMemoryResultRepository` remains available for narrow unit tests only.

## Polling Rules

Recommended MVP polling schedule:

- 30 minutes before kickoff: start active checks.
- During match: check every 5 minutes.
- Half-time: check once at half-time and schedule the next live check.
- 5 minutes after expected full-time: check for full-time status.
- Extra time: check every 5 minutes.
- Penalties: check every 2 minutes.
- After confirmed final status: lock result and rebuild leaderboard.

The schedule should be data-driven enough to avoid hardcoding one provider's status vocabulary into the rest of the app.

## Confirmed Result Consensus

The app confirms a result as soon as confidence is sufficient. There is no mandatory delay when independent sources agree.

Consensus rules:

1. If two different providers return the same final score with final status, confirm immediately.
2. If only one provider has a final result, store it as provisional and schedule a confirmation recheck.
3. If the same provider returns the same final score again after `RESULT_CONFIRMATION_DELAY_MINUTES`, confirm.
4. If providers return different final scores, set `NEEDS_REVIEW`, do not confirm, and do not rebuild the leaderboard.
5. Live and other non-final observations never confirm a result.

`RESULT_CONFIRMATION_DELAY_MINUTES` defaults to `10`. It is only the single-provider fallback delay.

Manual override can confirm or correct a result through the same model using `confirmationConfidence=manual`. There is no public admin UI; the fallback is an operator-only CLI and protected API endpoint.

## Manual Result Correction

Use manual confirmation only when provider data is missing, delayed, wrong, mapped to the wrong fixture, or leaves a match in `NEEDS_REVIEW`.

CLI example:

```bash
npm run results:confirm -- --matchId=1 --homeScore=2 --awayScore=1 --decidedAfter=FT --source=manual --confirmedBy=operator --notes="Verified from official broadcast"
```

Protected API endpoint:

```http
POST /api/results-agent/manual-confirm
x-results-agent-secret: <RESULTS_AGENT_SECRET>
content-type: application/json

{
  "matchId": 1,
  "homeScore": 2,
  "awayScore": 1,
  "status": "CONFIRMED_FINAL",
  "decidedAfter": "FT",
  "source": "manual",
  "confirmedBy": "operator",
  "notes": "Verified from official broadcast"
}
```

Security rules:

- The CLI is for trusted server/operator environments only.
- The API endpoint always requires `RESULTS_AGENT_SECRET`, regardless of mock/dry-run/live provider mode.
- The secret must be sent as `x-results-agent-secret`.
- The app never logs or returns the configured secret.

Manual confirmation behavior:

1. Validate that the match exists.
2. Validate non-negative integer scores.
3. Persist a `CONFIRMED_FINAL` result in `match_results`.
4. Set `confirmationSource=manual` and `confirmationConfidence=manual`.
5. Clear `NEEDS_REVIEW` metadata when a reviewed result is corrected.
6. Rebuild and persist the leaderboard through the existing points engine.
7. Update public dashboard/results/tournament state from persisted confirmed data.
8. Replace manual scorer rows for the same match when scorer input is supplied.
9. Write an audit row to `result_manual_corrections`.

Correction behavior:

- Same confirmed score submitted again: idempotent success; no duplicate leaderboard rows.
- Different score for an already confirmed match: treated as a correction, audit stores previous and new score, and leaderboard is rebuilt.
- Invalid match or invalid score: request fails safely and no result is persisted.

Manual corrections do not bypass scoring rules or write public mock/frontend data directly.

The protected operator UI lives at `/operator` and uses the same protected endpoint.

## Leaderboard Rebuild

When a result becomes confirmed final or a confirmed final result changes:

1. Save the confirmed match score and confirmation metadata.
2. Store a `ResultUpdate` record.
3. Rebuild leaderboard entries on the server.
4. Save rebuilt `LeaderboardEntry` rows.
5. Store `pointsRecalculatedAt`.

For MVP, full leaderboard rebuild is acceptable after each finalized result.

Sprint 12 connects this path to the official points engine in `src/domain/pointsEngine.ts`. The rebuild calculates official `6/4/2/0` match points from prediction seed data and confirmed finalized results, and can add group, play-off, champion, and top-scorer bonuses when the corresponding actual data is available.

Sprint 13 persists rebuilt leaderboard rows through `DatabaseResultRepository.replaceLeaderboard`. `GET /api/leaderboard` now prefers saved `leaderboard_entries`; if none exist yet, it falls back to seed leaderboard data without showing technical status text in the public UI.

Persisted leaderboard rows include:

- rank, points, exact scores, correct results, and hit rate
- matches scored
- match points
- group bonus points
- play-off bonus points
- top scorer bonus points
- total points
- last updated timestamp

## Render Hibernate Recovery

Render free services can sleep through polling windows.

MVP catch-up strategy:

1. If the web service wakes and stale matches exist, an API request or startup check triggers catch-up.
2. Catch-up reads persisted match result state and schedule data.
3. Catch-up fetches current provider data for stale scheduled/live/recent matches.
4. The agent upserts match result state and appends result update metadata.
5. Any newly confirmed final result triggers a leaderboard rebuild.
6. Rebuilt leaderboard rows and rebuild metadata are saved, so restart does not lose the latest standings.

No complex pending queue is needed for MVP. The database state and provider API are enough to recover missed polling intervals.

## End-to-End Simulation

Sprint 18 adds a controlled first-matchday simulation. It uses `SimulationResultProvider`, not external APIs.

Commands:

```bash
npm run simulate:reset
npm run simulate:matchday1
npm run simulate:matchday1:disagreement
```

The simulation proves:

- first final observations become provisional and do not rebuild the leaderboard
- repeated matching final observations become confirmed after the configured fallback delay
- confirmed results persist through `match_results`
- leaderboard rows persist through `leaderboard_entries`
- public latest results only show confirmed final scores
- derived group standings and simulation top scorers refresh after confirmation
- provider disagreement becomes `NEEDS_REVIEW` and does not rebuild the leaderboard

The public frontend consumes one synchronized confirmed-results state through `GET /api/public-dashboard`, `GET /api/results`, `GET /api/leaderboard`, and `GET /api/tournament`. These endpoints intentionally omit provider raw payloads and provisional final scores.

Public tournament state rules:

- Group standings update from confirmed group-stage results only.
- Group leaders are derived from the same group standings.
- Latest results include confirmed final results only.
- Top scorer standings are derived from confirmed scorer data only.
- Playoff bracket slots stay as placeholders until qualifiers are explicitly resolved from confirmed group standings.
- Knockout scores are public only after confirmed knockout results.

See `docs/E2E_SIMULATION.md` for the exact simulated matches and expected output.

Sprint 5 adds catch-up endpoints that remain mock-default:

- `GET /api/results-agent/status`
- `POST /api/results-agent/run`

The `POST` endpoint runs one safe/idempotent update cycle. Mock mode remains manually triggerable for local development. Live write mode requires `x-results-agent-secret`; dry-run mode fetches provider updates without persisting DB changes.

## Provider Chain Architecture

Sprint 17 supports a configurable provider chain while keeping mock as the default provider.

Environment variables:

- `RESULTS_PROVIDER=mock | free-worldcup | open-worldcup | api-football | football-data | sportmonks`
- `RESULTS_PROVIDER_CHAIN=mock` or comma-separated provider names such as `open-worldcup,football-data`
- `RESULTS_API_KEY`
- `RESULTS_API_BASE_URL`
- `RESULTS_COMPETITION_ID`
- `RESULTS_SEASON`
- `API_FOOTBALL_API_KEY`
- `API_FOOTBALL_API_BASE_URL`
- `API_FOOTBALL_HOST`
- `API_FOOTBALL_COMPETITION_ID`
- `API_FOOTBALL_SEASON`
- `FOOTBALL_DATA_API_KEY`
- `FOOTBALL_DATA_API_BASE_URL`
- `FOOTBALL_DATA_COMPETITION_ID`
- `FOOTBALL_DATA_SEASON`
- `SPORTMONKS_API_KEY`
- `SPORTMONKS_API_BASE_URL`
- `SPORTMONKS_COMPETITION_ID`
- `SPORTMONKS_SEASON`
- `RESULTS_WRITE_MODE=mock | dry-run | live`
- `RESULT_CONFIRMATION_DELAY_MINUTES`
- `RESULTS_AGENT_SECRET`

Defaults are safe:

- `RESULTS_PROVIDER` defaults to `mock`.
- `RESULTS_PROVIDER_CHAIN` defaults to the selected provider, so default chain is `mock`.
- `RESULTS_WRITE_MODE` defaults to `mock`.
- Missing API keys do not crash the app in mock mode.
- Non-mock providers fail clearly if required provider config is missing.
- `RESULTS_WRITE_MODE=live` requires `RESULTS_AGENT_SECRET`.
- `RESULTS_WRITE_MODE=dry-run` fetches provider data, runs consensus, but skips result, run summary, and leaderboard persistence.
- Open World Cup dry-run uses `imports/open-worldcup-fixtures-2026.candidate.json` as a high-confidence-only lookup.
- Medium, low, and unmatched open-worldcup rows are skipped and reported; they are never promoted automatically.
- `npm run open-worldcup:dry-run -- --now=2026-06-11T19:30:00Z` exercises the open-worldcup candidate through the provider chain in dry-run mode.
- Fixture `99` remains the known reversed knockout pairing and stays skipped until manual review.
- `RESULT_CONFIRMATION_DELAY_MINUTES` defaults to `10` and controls only the single-provider fallback confirmation delay.

`createResultProvider(config)` returns `MockResultProvider` by default. When `RESULTS_PROVIDER_CHAIN` contains multiple providers, it returns a `ProviderChainResultProvider` that fetches the primary provider first and asks verifier providers only when confirmation is useful.

The `free-worldcup` preset is the free-only production path. It always uses OpenWorldCup as the primary live/provisional score and scorer source. It adds football-data.org as a final-score verifier only when football-data.org free-token config and confirmed fixture mapping are present. Static fixture fallback comes from the bundled World Cup 2026 schedule data; static fixtures never create scores or scorers.

Free provider-chain dry-run example:

```bash
RESULTS_PROVIDER=free-worldcup
RESULTS_WRITE_MODE=dry-run
RESULT_CONFIRMATION_DELAY_MINUTES=10
OPEN_WORLDCUP_API_BASE_URL=https://worldcup26.ir
FOOTBALL_DATA_API_BASE_URL=https://api.football-data.org/v4
FOOTBALL_DATA_COMPETITION_ID=WC
FOOTBALL_DATA_SEASON=2026
FOOTBALL_DATA_API_KEY=...
```

Do not commit provider API keys.

## Rate Limit Strategy

Free and low-cost result providers can have small request budgets. The chain therefore avoids polling every provider for every scheduled match:

- The primary provider is queried first.
- Verifier providers are queried only when the primary provider returns a final score or the stored match state is already awaiting confirmation/review.
- Ordinary scheduled/live primary updates do not fan out to secondary providers.
- Provider failures are returned as warnings so another provider can still contribute an observation.
- Dry-run mode should be used before live writes to observe payload shape and request volume.

## External Cron on Render Free

Render Free in this setup does not provide Shell/Cron, so trigger the agent from an external cron service.

Recommended option: `cron-job.org`

Example request:

- Method: `POST`
- URL: `https://jalka-mm.onrender.com/api/results-agent/run`
- Headers: `x-results-agent-secret: <RESULTS_AGENT_SECRET>`
- Body: empty JSON `{}` if the cron service requires a body
- Schedule: every 10 minutes during matchdays, or every 15 minutes if stability matters more than freshness

Expected success:

- `200` response with a JSON summary
- `dryRun: false`
- no raw provider payloads
- no secret echoed back

Phone check:

- `GET /api/results-agent/status`
- Shows provider chain, write mode, last run summary, pending warnings count, and confirmed-result count
- Does not expose secrets or raw provider data

Operator fallback:

- Use `/operator` when a result is missing, wrong, or needs scorer correction.
- The manual confirm endpoint remains the recovery path for ambiguous or corrected results.

## Provider Contract

The provider contract remains provider-agnostic. Providers return normalized `ResultUpdate` objects with optional provider metadata:

- internal `matchId`
- optional `providerMatchId`
- normalized internal status
- home and away score
- minute
- regular/extra-time/penalty period where available
- `rawProviderStatus`
- provider last update timestamp
- conservative warning when status cannot be confidently mapped

Unknown statuses must preserve `rawProviderStatus`, normalize conservatively, and must not be marked final unless the adapter is confident.

## Match Mapping

Provider fixture ids must be stored outside UI code. The example structure lives at `src/data/providerMatchMap.example.json`.

Mapping strategy:

1. Match by provider competition/tournament and season.
2. Match by kickoff time.
3. Match by home/away team identifiers when available.
4. Store the provider fixture id once confirmed.
5. Never rely only on team names after a provider fixture id exists.

The map should be validated before live writes are enabled. Knockout slots may exist before teams are known; provider fixture ids are therefore more reliable than names.

Sprint 14 behavior:

- If a Sportmonks fixture id exists for the internal match, the adapter fetches that fixture and normalizes the result.
- If no Sportmonks fixture id exists, the adapter returns a warning update and skips the network call.
- The live write path must not guess fixture ids from team names.

Sprint 15 validation:

- `npm run validate:provider-match-map` checks provider match map structure.
- In `RESULTS_WRITE_MODE=live`, Sportmonks mappings must have `providerFixtureId` and `confidence: "confirmed"`.
- Live validation can require all internal match ids to be mapped before production writes.

Sportmonks fixture mapping process:

1. Keep `RESULTS_PROVIDER=sportmonks` and `RESULTS_WRITE_MODE=dry-run` while testing.
2. Fetch the Sportmonks World Cup 2026 fixture list outside the public app runtime.
3. Match fixtures by competition id, season, kickoff UTC, and participants.
4. Write confirmed fixture ids into the provider match map.
5. Mark each verified row with `confidence: "confirmed"`.
6. Run `npm run validate:provider-match-map`.
7. Run a dry-run result-agent cycle against a small mapped subset.
8. Enable `RESULTS_WRITE_MODE=live` only after the map is complete and the endpoint secret is configured.

## Production Safety Rules

- Mock mode can remain unprotected while it uses deterministic mock provider data and does not call external APIs.
- Live write mode requires `x-results-agent-secret: <RESULTS_AGENT_SECRET>` on `POST /api/results-agent/run`.
- Dry-run mode may call the configured provider but does not persist match results, run summaries, or leaderboard rows.
- API keys must stay server-side and must never be committed.
- Provider raw payload storage should be bounded and optional.
- Provider calls must be made only from the backend result agent.

## Live Open World Cup Rollout

Render environment checklist:

```bash
RESULTS_PROVIDER_CHAIN=open-worldcup
RESULTS_WRITE_MODE=live
OPEN_WORLDCUP_API_BASE_URL=https://worldcup26.ir
RESULTS_AGENT_SECRET=<set in Render>
RESULT_CONFIRMATION_DELAY_MINUTES=10
```

Safety rules:

- Only high-confidence open-worldcup mappings are used automatically.
- Medium, low, and unmatched mappings are skipped and reported.
- Fixture `99` remains the known reversed knockout pairing and is not processed automatically.
- Non-final provider statuses never confirm a result.
- Confirmed-final persistence and leaderboard rebuilds still happen only through the existing consensus pipeline.

Rollback:

- Set `RESULTS_WRITE_MODE=mock` to stop live writes while leaving the provider config in place.
- Or set `RESULTS_PROVIDER_CHAIN=mock` to disable open-worldcup entirely.
- Redeploy after changing env vars.
- The operator UI remains available for manual correction when live automation is paused.

## Sprint 5 Deferred Work

- Move remaining narrow tests away from `InMemoryResultRepository` where useful.
- Complete confirmed Sportmonks fixture mapping for all tournament matches.
- Verify Sportmonks account coverage, rate limits, and payload shape before live tournament use.
- Apply final Excel-derived prediction data to the scoring engine.

## Boundaries

- The public frontend never calls the football provider directly.
- The frontend never recalculates official points.
- API keys stay server-side.
- Provider raw payloads should be optional and bounded in size if stored.
