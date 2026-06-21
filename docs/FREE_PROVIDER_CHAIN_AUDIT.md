# Free Provider Chain Audit

Audit date: 2026-06-21

## Decision

Use a free-only provider chain:

1. Primary live/provisional score and scorer provider: OpenWorldCup (`worldcup26.ir`)
2. Optional final-score/status verifier: football-data.org free tier (`WC`, season `2026`) after fixture ids are confirmed
3. Static fixture fallback: bundled `src/data/worldcup2026/*.json`, with OpenFootball/worldcup.json usable as an offline cross-check/import source
4. Scorer fallback: manual correction

Do not use API-Football, SportMonks, or other paid-first providers as the production primary while the free-only constraint is active.

## Provider Findings

### OpenWorldCup

Usable for:

- Hosted no-key World Cup 2026 match feed
- Score/status polling
- Scorer strings when present

Limitations:

- Final status can lag badly after full time.
- Scorer names may contain transliteration/encoding issues.
- Kickoff values are provider-local strings, not canonical UTC timestamps.
- It should remain behind the existing consensus/manual safety model.

Role: primary free live/provisional provider and scorer source.

### football-data.org

Usable for:

- Free-tier World Cup (`WC`) score/status verification, with an API token
- Delayed final-score/status confirmation once fixture ids are mapped

Limitations:

- Free tier is delayed, so it is not a live primary source.
- Free tier does not provide goal scorers; goal scorer data belongs to paid/deep data coverage.
- Fixture ids must be confirmed before live writes.

Role: optional free final-score/status verifier, not a scorer source.

Required env when enabled:

```bash
FOOTBALL_DATA_API_KEY=<free token>
FOOTBALL_DATA_API_BASE_URL=https://api.football-data.org/v4
FOOTBALL_DATA_COMPETITION_ID=WC
FOOTBALL_DATA_SEASON=2026
```

### OpenFootball/worldcup.json

Usable for:

- Static fixture/team fallback
- Offline schedule cross-checking
- Recovering from provider fixture-list outages

Limitations:

- It is a static data source, not live results.
- It cannot publish final scores or scorers.

Role: fixture fallback only.

### API-Football and SportMonks

Not usable under this sprint constraint as primary providers. They are paid-first providers for production-grade result coverage.

## Recommended Runtime Config

OpenWorldCup-only free live mode:

```bash
RESULTS_PROVIDER=free-worldcup
RESULTS_WRITE_MODE=live
OPEN_WORLDCUP_API_BASE_URL=https://worldcup26.ir
RESULTS_AGENT_SECRET=<set in Render>
```

Free chain with football-data.org verifier after confirmed fixture mapping:

```bash
RESULTS_PROVIDER=free-worldcup
RESULTS_WRITE_MODE=live
OPEN_WORLDCUP_API_BASE_URL=https://worldcup26.ir
FOOTBALL_DATA_API_KEY=<free token>
FOOTBALL_DATA_API_BASE_URL=https://api.football-data.org/v4
FOOTBALL_DATA_COMPETITION_ID=WC
FOOTBALL_DATA_SEASON=2026
RESULTS_AGENT_SECRET=<set in Render>
```

The `free-worldcup` preset includes football-data.org only when at least one confirmed `football-data` fixture mapping exists. Without confirmed mapping, it falls back to OpenWorldCup only instead of making unmapped verifier calls.

## Scorer Limitation

No verified free provider found in this audit provides reliable World Cup 2026 scorer data with provider player ids. Scorers must remain:

- OpenWorldCup when present
- Manual correction when OpenWorldCup is delayed, missing, or corrupt

## Sources

- football-data.org API docs: https://www.football-data.org/documentation/api
- football-data.org pricing/plan notes: https://www.football-data.org/pricing
- football-data.org policies: https://docs.football-data.org/general/v4/policies.html
- OpenFootball World Cup JSON: https://github.com/openfootball/worldcup.json
- OpenWorldCup feed: https://worldcup26.ir/get/games
