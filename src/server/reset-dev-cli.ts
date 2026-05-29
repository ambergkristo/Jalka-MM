import { resetDevData } from './db.js';

resetDevData({ allowDestructive: true });
console.log('Deleted local development data. This command is destructive.');
