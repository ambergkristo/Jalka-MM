import { recalculateScores, seedDemo } from './db.js';
import { confirmationFromArgv } from './scriptArgs.js';

seedDemo({ allowDestructive: true, confirmation: confirmationFromArgv(process.argv) });
recalculateScores();
console.log('Reset local data and seeded demo players. This command is destructive.');
