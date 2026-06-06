# API-Football Discovery

Use this command to verify the API-Football key, check World Cup 2026 coverage, and generate a candidate fixture map without any database writes.

## Local env

```bash
API_FOOTBALL_API_KEY=...
API_FOOTBALL_API_BASE_URL=https://v3.football.api-sports.io
API_FOOTBALL_HOST=v3.football.api-sports.io
```

## Run

```bash
npm run api-football:discover
```

The script uses `league=1` and `season=2026`, fetches read-only league and fixture data, and writes a candidate file to `imports/api-football-fixtures-2026.candidate.json`.

## PASS

PASS means:

- fixtures were found
- fixture IDs were returned
- a candidate map file was generated

## Still needed after PASS

- review the candidate map
- move confirmed mappings into the production provider map
- configure the Render environment
- wire the cron/agent trigger
- run the dry-run against Render before enabling live writes
