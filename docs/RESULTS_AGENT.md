# Results Agent Plan

The results agent is the backend workflow that updates tournament match statuses and scores. Sprint 5 implements the first mock-only foundation; a real football provider is still deferred.

Current implementation modules live in `src/server/results/`:

- `resultTypes.ts`
- `resultProvider.ts`
- `mockResultProvider.ts`
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

## Sprint 5 Deferred Work

- Replace `InMemoryResultRepository` with a database-backed repository.
- Persist score, minute, provider, and recalculation metadata in final schema shape.
- Connect a real football data provider.
- Apply final Excel-derived prediction data to the scoring engine.
- Save rebuilt `LeaderboardEntry` rows after recalculation.
- Add production protection for the run endpoint.

## Boundaries

- The public frontend never calls the football provider directly.
- The frontend never recalculates official points.
- API keys stay server-side.
- Provider raw payloads should be optional and bounded in size if stored.
