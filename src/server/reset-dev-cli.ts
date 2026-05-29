import { resetDevData } from './db.js';
import { confirmationFromArgv } from './scriptArgs.js';

await resetDevData({ allowDestructive: true, confirmation: confirmationFromArgv(process.argv) });
console.log('Deleted local development data. This command is destructive.');
