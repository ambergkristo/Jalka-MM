# Results Agent Plan

The results agent is a future separate agent or cron workflow that updates tournament match statuses and scores. It is not implemented in Sprint 0.

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

## Boundaries

- The public frontend never calls the football provider directly.
- The frontend never recalculates official points.
- API keys stay server-side.
- Provider raw payloads should be optional and bounded in size if stored.
