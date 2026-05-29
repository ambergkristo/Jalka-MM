import { recalculateScores, seedDemo } from './db.js';

seedDemo({ allowDestructive: true });
recalculateScores();
console.log('Reset local data and seeded demo players. This command is destructive.');
