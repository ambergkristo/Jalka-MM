# Operator Manual Results

Protected operator route:

```text
/operator
```

Access:

- Enter `RESULTS_AGENT_SECRET` on the page.
- The secret is stored only in session storage on the client.
- Requests send `x-results-agent-secret` to the protected backend endpoint.

Workflow:

1. Open `/operator`.
2. Unlock the page with the operator secret.
3. Select the match.
4. Enter the final score.
5. Add scorers if needed.
6. Submit the confirmation.

Result behavior:

- The backend writes a confirmed final result.
- The points engine rebuilds the leaderboard.
- Public dashboard/results/tournament data refresh from persisted state.
- Manual scorer rows replace earlier manual scorer rows for the same match.

Safety copy:

- Kinnitatud tulemus arvutab edetabeli uuesti.
- Kasuta ainult lõpliku tulemuse kinnitamiseks.
