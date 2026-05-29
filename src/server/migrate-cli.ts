import { migrate } from './db.js';

await migrate();
console.log('Database migration completed.');
