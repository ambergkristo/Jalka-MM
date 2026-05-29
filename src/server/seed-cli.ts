import { recalculateScores, seedTournamentData } from './db.js';

await seedTournamentData();
await recalculateScores();
console.log('Seeded tournament structure data without deleting players or predictions.');
