# Open World Cup Provider Candidate

The repository `rezarahiminia/worldcup2026` exposes a hosted API at `https://worldcup26.ir`.

Discovery command:

```bash
npm run open-worldcup:discover
```

Dry-run command:

```bash
npm run open-worldcup:dry-run -- --now=2026-06-11T19:30:00Z
```

Current discovery result:

- API reachable: yes
- Team endpoint reachable: yes, via `/get/teams`
- Matches found: 104
- Sample fixture data is returned
- Team ids are now resolved to English team names before fixture matching
- Confidence to auto-map fixtures into production is still conservative and must be reviewed
- Only high-confidence candidate mappings are used automatically in the result-agent path
- The generated candidate file is written to `imports/open-worldcup-fixtures-2026.candidate.json`
- The generated team reference file is written to `imports/open-worldcup-teams-2026.candidate.json`

Readiness notes:

- Keep the provider disabled by default.
- The hosted API currently returns match records and a team list, so numeric ids can be resolved before mapping.
- Fixture mapping still needs review before any production provider config is updated.
- Dry-run mode can read the candidate fixture map, process observations, and skip medium/low/unmatched rows without DB writes.
- Live mode uses the same high-confidence-only lookup and still relies on the existing confirmation pipeline before any public final result is persisted.
- Fixture 99 remains the known reversed knockout pairing and is skipped until manually verified.
- Non-final statuses are treated as non-final and do not confirm results.
- Review the candidate file before promoting any mapping into production provider config.

Suggested env:

```bash
OPEN_WORLDCUP_API_BASE_URL=https://worldcup26.ir
```

The provider can be enabled through `RESULTS_PROVIDER_CHAIN` only after the candidate map is reviewed.
