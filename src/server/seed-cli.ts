import { recalculateScores, seedTournamentData } from './db.js';

seedTournamentData();
recalculateScores();
console.log('Seeded tournament structure data without deleting players or predictions.');
