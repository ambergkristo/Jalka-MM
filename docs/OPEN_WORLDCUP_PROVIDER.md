# Open World Cup Provider Candidate

The repository `rezarahiminia/worldcup2026` exposes a hosted API at `https://worldcup26.ir`.

Discovery command:

```bash
npm run open-worldcup:discover
```

Current discovery result:

- API reachable: yes
- Matches found: 104
- Sample fixture data is returned
- Confidence to auto-map fixtures into production is not ready yet
- The generated candidate file is written to `imports/open-worldcup-fixtures-2026.candidate.json`

Readiness notes:

- Keep the provider disabled by default.
- The hosted API currently returns match records, but the team labels are not specific enough for confident automatic fixture mapping.
- Review the candidate file before promoting any mapping into production provider config.

Suggested env:

```bash
OPEN_WORLDCUP_API_BASE_URL=https://worldcup26.ir
```

The provider can be enabled through `RESULTS_PROVIDER_CHAIN` only after the candidate map is reviewed.
