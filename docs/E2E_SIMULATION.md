# Matchday Simulation

Sprint 18 adds a controlled end-to-end simulation for the first matchday. It is a developer workflow only. It does not call real football APIs and it does not enable live writes.

## What It Tests

The simulation exercises the real backend path:

```text
simulation provider observations
-> result agent
-> consensus engine
-> persisted confirmed results
-> points engine
-> persisted leaderboard rebuild
-> public dashboard snapshot
```

It also refreshes derived group standings and top scorer standings from confirmed simulation data.

## Simulated Matches

The simulation uses the first three fixtures from the current seed schedule:

| Match | Score | Simulated scorers |
| --- | --- | --- |
| Mexico vs South Africa | 2-1 | Santiago Gimenez, Edson Alvarez; Percy Tau |
| Korea Republic vs Czechia | 1-1 | Son Heung-min; Patrik Schick |
| Canada vs Bosnia and Herzegovina | 2-0 | Jonathan David, Alphonso Davies |

Scorers are simulation-local names from the relevant national teams. Full squad validation is deferred until a real squad data source exists.

## Commands

Reset simulation runtime state:

```bash
npm run simulate:reset
```

Run the full first-matchday simulation:

```bash
npm run simulate:matchday1
```

Run the disagreement scenario:

```bash
npm run simulate:matchday1:disagreement
```

## Expected Behavior

The matchday simulation starts by resetting runtime state and reseeding the tournament schedule.

First result-agent run:

- provider returns final scores
- results become provisional / `Kinnitamisel`
- leaderboard does not rebuild
- public latest results remain empty

Second confirming run:

- same provider repeats the same final scores after the fallback delay
- results become confirmed final
- leaderboard rebuilds and is persisted
- public latest results show the three confirmed scores
- affected group standings update
- simulated top scorer standings update

Disagreement run:

- provider A and provider B return different final scores
- results become `NEEDS_REVIEW`
- leaderboard does not rebuild

## Public API

`GET /api/public-dashboard` returns confirmed public state:

- `upcomingMatches`
- `latestResults`
- `groupStandings`
- `groupLeaders`
- `topScorers`
- `tournamentSummary`
- `tournamentStats`
- `tournamentProgressByStage`
- `playoffBracket`

Only `CONFIRMED_FINAL` match results are exposed as final scores.

Additional public route-specific endpoints:

- `GET /api/results` returns upcoming matches and confirmed results only.
- `GET /api/leaderboard` returns persisted recalculated leaderboard rows when available.
- `GET /api/tournament` returns public group standings, top scorers, playoff bracket, tournament summary, statistics, and stage progress.

The playoff bracket is gated by confirmed tournament state:

- Before group qualifiers are resolved, bracket slots remain placeholders such as `A1`, `B2`, `Parim 3. koht`, and `1/16-1 võitja`.
- Simulated first matchday results update group standings, latest results, leaderboard, and top scorers, but do not populate playoff teams.
- Knockout country names and scores must come only from confirmed knockout state, not demo/mock bracket data.

## Frontend Verification

Manual verification sequence:

1. Run `npm run simulate:reset`.
2. Open `/`.
   - Latest results should show `Lõppenud mänge veel ei ole.`
   - Opening fixtures should remain visible.
3. Run `npm run simulate:matchday1`.
4. Open `/`.
   - Latest results should show the three confirmed simulated results.
   - Top 5 leaderboard should reflect persisted recalculated rows.
   - Group leaders should reflect updated standings where matches were confirmed.
5. Open `/results`.
   - Confirmed results should be visible.
   - Upcoming list should no longer include confirmed matches.
6. Open `/leaderboard`.
   - Persisted recalculated leaderboard should be used.
7. Open `/tournament`.
   - Group A and B standings should reflect the confirmed results.
   - Simulated top scorers should be visible.
   - Play-off should still show placeholder slots only.
8. Run `npm run simulate:reset` again.
9. Reopen `/`.
   - Confirmed latest results should be empty again.

## Known Gaps

- Simulation scorer data is local to this workflow and not validated against official squad lists.
- Group standings recalculate from confirmed group-stage results only; broader tournament tie-break rules remain deferred.
- Top scorer standings are refreshed from simulation scorer data only. Real provider scorer/event integration remains a later sprint.
