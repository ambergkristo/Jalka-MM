# Results Agent Plan

The results agent is the backend workflow that updates tournament match statuses and scores. Sprint 5 implements the first mock-only foundation; a real football provider is still deferred.

Current implementation modules live in `src/server/results/`:

- `resultTypes.ts`
- `resultProvider.ts`
- `resultProviderConfig.ts`
- `resultProviderFactory.ts`
- `mockResultProvider.ts`
- `realResultProviderStub.ts`
- `providerMatchMap.ts`
- `matchScheduler.ts`
- `resultAgent.ts`
- `leaderboardRebuild.ts`
- `inMemoryResultRepository.ts`
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

Sprint 5 stores this through an in-memory repository interface. The existing database schema already has `match_results`, `result_updates`, and `leaderboard_entries` tables, but the production repository implementation is intentionally deferred until the real import/provider work starts.

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

Sprint 7 connects this path to the MVP points engine in `src/domain/pointsEngine.ts`. The rebuild now calculates match-prediction points from prediction seed data and finalized results. Rebuilt entries are returned in result-agent summaries and exposed in memory through `GET /api/leaderboard`; database persistence is still deferred.

## Render Hibernate Recovery

Render free services can sleep through polling windows.

MVP catch-up strategy:

1. If the web service wakes and stale matches exist, an API request or startup check triggers catch-up.
2. Catch-up fetches current provider data for stale scheduled/live/recent matches.
3. The agent updates statuses and scores.
4. Any newly finalized result triggers a leaderboard rebuild.

No complex pending queue is needed for MVP. The database state and provider API are enough to recover missed polling intervals.

Sprint 5 adds mock-only catch-up endpoints:

- `GET /api/results-agent/status`
- `POST /api/results-agent/run`

The `POST` endpoint runs one safe/idempotent update cycle against the mock provider. It is public for now because it makes no external calls, has no real side effects outside process memory, and exists only as architecture groundwork. Before connecting a real provider or persistent production writes, protect this endpoint with a scheduler secret, internal cron trigger, or equivalent server-side authorization.

## Provider Selection Architecture

Sprint 11 adds provider configuration and factory scaffolding without making real network calls.

Environment variables:

- `RESULTS_PROVIDER=mock | api-football | football-data | sportmonks`
- `RESULTS_API_KEY`
- `RESULTS_API_BASE_URL`
- `RESULTS_COMPETITION_ID`
- `RESULTS_SEASON`
- `RESULTS_WRITE_MODE=mock | live`
- `RESULTS_AGENT_SECRET`

Defaults are safe:

- `RESULTS_PROVIDER` defaults to `mock`.
- `RESULTS_WRITE_MODE` defaults to `mock`.
- Missing API keys do not crash the app in mock mode.
- Non-mock providers fail clearly if required provider config is missing.
- `RESULTS_WRITE_MODE=live` requires `RESULTS_AGENT_SECRET`.

`createResultProvider(config)` returns `MockResultProvider` by default. Non-mock providers currently return a stub that throws a clear Sprint 12 deferred-implementation error if called.

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

## Production Safety Rules

- Mock mode can remain unprotected while it only mutates in-memory mock state.
- Live write mode must require a secret header, internal cron identity, or equivalent protection before persistent writes are enabled.
- API keys must stay server-side and must never be committed.
- Provider raw payload storage should be bounded and optional.
- Provider calls must be made only from the backend result agent.

## Sprint 5 Deferred Work

- Replace `InMemoryResultRepository` with a database-backed repository.
- Persist score, minute, provider, and recalculation metadata in final schema shape.
- Implement the selected real football provider adapter.
- Apply final Excel-derived prediction data to the scoring engine.
- Save rebuilt `LeaderboardEntry` rows after recalculation.
- Add production protection for the run endpoint.

## Boundaries

- The public frontend never calls the football provider directly.
- The frontend never recalculates official points.
- API keys stay server-side.
- Provider raw payloads should be optional and bounded in size if stored.
