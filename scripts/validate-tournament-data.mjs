import { readTournamentData, validateTournamentData } from './tournament-data-lib.mjs';

const validation = validateTournamentData(readTournamentData());

for (const warning of validation.warnings) console.warn(`Warning: ${warning}`);
if (validation.errors.length) {
  for (const error of validation.errors) console.error(`Error: ${error}`);
  process.exit(1);
}

console.log(JSON.stringify({
  valid: true,
  counts: validation.counts,
  unresolved: validation.unresolved,
  riskLevel: validation.riskLevel
}, null, 2));
