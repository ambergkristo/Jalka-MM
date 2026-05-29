import { recalculateScores, seedDemo } from './db.js';
import { confirmationFromArgv } from './scriptArgs.js';

await seedDemo({ allowDestructive: true, confirmation: confirmationFromArgv(process.argv) });
await recalculateScores();
console.log('Reset local data and seeded demo players. This command is destructive.');
