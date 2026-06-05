# Results Agent Plan

The results agent is the backend workflow that updates tournament match statuses and scores. Mock remains the default provider. Sprint 14 adds the first real adapter for Sportmonks. Sprint 15 protects live writes with a scheduler secret and adds dry-run support; live use still requires credentials and confirmed fixture mapping.

Current implementation modules live in `src/server/results/`:

- `resultTypes.ts`
- `resultProvider.ts`
- `resultProviderConfig.ts`
- `resultProviderFactory.ts`
- `mockResultProvider.ts`
- `sportmonksResultProvider.ts`
- `realResultProviderStub.ts`
- `providerMatchMap.ts`
- `matchScheduler.ts`
- `resultAgent.ts`
- `leaderboardRebuild.ts`
- `databaseResultRepository.ts`
- `inMemoryResultRepository.ts`
- `leaderboardRepository.ts`
- `resultPersistenceSchema.ts`
- `resultAgentRuntime.ts`

## Responsibilities

The agent will:

- Fetch match results from a football data API.
- Normalize provider-specific statuses into app statuses.
- Update match statuses and scores in the database.
- Detect finalized results.
- Rebuild and save the leaderboard after finalized result changes.
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

Finalized result states should be locked once accepted. If a provider later corrects a finalized score, the agent should record the change and rebuild the leaderboard again.

## Stored Update Metadata

Each tracked update should store:

- `lastCheckedAt`
- `nextCheckAt`
- `status`
- `isFinal`
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
- After final status: lock result and rebuild leaderboard.

The schedule should be data-driven enough to avoid hardcoding one provider's status vocabulary into the rest of the app.

## Leaderboard Rebuild

When a result becomes final or a finalized result changes:

1. Save the match score and final status.
2. Store a `ResultUpdate` record.
3. Rebuild leaderboard entries on the server.
4. Save rebuilt `LeaderboardEntry` rows.
5. Store `pointsRecalculatedAt`.

For MVP, full leaderboard rebuild is acceptable after each finalized result.

Sprint 12 connects this path to the official points engine in `src/domain/pointsEngine.ts`. The rebuild calculates official `6/4/2/0` match points from prediction seed data and finalized results, and can add group, play-off, champion, and top-scorer bonuses when the corresponding actual data is available.

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
5. Any newly finalized result triggers a leaderboard rebuild.
6. Rebuilt leaderboard rows and rebuild metadata are saved, so restart does not lose the latest standings.

No complex pending queue is needed for MVP. The database state and provider API are enough to recover missed polling intervals.

Sprint 5 adds catch-up endpoints that remain mock-default:

- `GET /api/results-agent/status`
- `POST /api/results-agent/run`

The `POST` endpoint runs one safe/idempotent update cycle. Mock mode remains manually triggerable for local development. Live write mode requires `x-results-agent-secret`; dry-run mode fetches provider updates without persisting DB changes.

## Provider Selection Architecture

Sprint 11 adds provider configuration and factory scaffolding. Sprint 14 adds the first real adapter for Sportmonks while keeping mock as the default provider.

Environment variables:

- `RESULTS_PROVIDER=mock | api-football | football-data | sportmonks`
- `RESULTS_API_KEY`
- `RESULTS_API_BASE_URL`
- `RESULTS_COMPETITION_ID`
- `RESULTS_SEASON`
- `RESULTS_WRITE_MODE=mock | live`
- `RESULTS_WRITE_MODE=mock | dry-run | live`
- `RESULTS_AGENT_SECRET`

Defaults are safe:

- `RESULTS_PROVIDER` defaults to `mock`.
- `RESULTS_WRITE_MODE` defaults to `mock`.
- Missing API keys do not crash the app in mock mode.
- Non-mock providers fail clearly if required provider config is missing.
- `RESULTS_WRITE_MODE=live` requires `RESULTS_AGENT_SECRET`.
- `RESULTS_WRITE_MODE=dry-run` fetches provider data but skips result, run summary, and leaderboard persistence.

`createResultProvider(config)` returns `MockResultProvider` by default. `RESULTS_PROVIDER=sportmonks` returns `SportmonksResultProvider` when required config is present. API-Football and football-data.org remain deferred stubs until explicitly implemented.

Sportmonks env example:

```bash
RESULTS_PROVIDER=sportmonks
RESULTS_API_BASE_URL=https://api.sportmonks.com
RESULTS_COMPETITION_ID=732
RESULTS_SEASON=2026
RESULTS_WRITE_MODE=dry-run
RESULTS_API_KEY=...
```

Do not commit `RESULTS_API_KEY`.

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
