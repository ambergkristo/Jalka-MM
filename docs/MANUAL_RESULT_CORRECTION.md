# Manual Result Correction

This document describes the operator fallback for confirming or correcting match results when provider consensus is missing, delayed, wrong, or stuck in `NEEDS_REVIEW`.

Manual correction is not a public admin feature. It must be run only from a trusted environment by an operator who has verified the result.

## When To Use

Use this fallback when:

- providers disagree on a final score
- provider data is late or missing
- fixture mapping is wrong or uncertain
- extra-time or penalty state is unclear
- a match remains in `NEEDS_REVIEW`
- a previously confirmed score must be corrected

Do not use it for provisional/live scores. Public results and leaderboard scoring must remain confirmed-only.

## CLI Command

Example:

```bash
npm run results:confirm -- --matchId=1 --homeScore=2 --awayScore=1 --decidedAfter=FT --source=manual --confirmedBy=operator --notes="Verified from official broadcast"
```

Supported arguments:

- `--matchId=1`
- `--homeScore=2`
- `--awayScore=1`
- `--decidedAfter=FT | AET | PEN`
- `--penaltyWinnerTeamId=<team-id>`
- `--penaltyWinnerTeamCode=<team-code>`
- `--source=manual`
- `--confirmedBy=<operator-or-system-label>`
- `--notes=<short verification note>`

The CLI does not require `RESULTS_AGENT_SECRET` because it is intended for trusted server-side use only.

## Protected API Endpoint

Endpoint:

```http
POST /api/results-agent/manual-confirm
x-results-agent-secret: <RESULTS_AGENT_SECRET>
content-type: application/json
```

Body:

```json
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

The endpoint is always protected. It rejects missing or wrong `x-results-agent-secret` values even when the result agent is in mock mode.

## Pipeline

Manual confirmation uses the same backend pipeline as provider-confirmed results:

```text
manual confirmed result
-> match_results CONFIRMED_FINAL
-> result_updates audit row
-> result_manual_corrections audit row
-> leaderboard rebuild through points engine
-> persisted leaderboard_entries
-> public dashboard/results/tournament state
```

It does not update frontend mock data and does not bypass the points engine.

## Idempotency And Corrections

- First valid confirmation confirms the result and rebuilds the leaderboard.
- Repeating the same confirmed score succeeds idempotently and does not duplicate leaderboard rows.
- Submitting a different score for an already confirmed match is a correction. The previous score and new score are written to `result_manual_corrections`, and the leaderboard is rebuilt.
- Manual confirmation of a `NEEDS_REVIEW` match clears the review state.

## Validation Rules

The service rejects:

- unknown `matchId`
- negative scores
- non-integer scores
- any manual status other than `CONFIRMED_FINAL`
- invalid `decidedAfter` values

## Operational Checks

Recommended local smoke sequence:

```bash
npm run simulate:reset
npm run results:confirm -- --matchId=1 --homeScore=2 --awayScore=1 --decidedAfter=FT --source=manual --confirmedBy=operator --notes="smoke test"
npm run simulate:reset
```

Expected after confirmation:

- public latest results include the confirmed match
- leaderboard rows are rebuilt and persisted
- audit row exists in `result_manual_corrections`

Expected after reset:

- public latest results are empty
- leaderboard returns to pre-result zero state
- simulation/runtime correction state is cleared
