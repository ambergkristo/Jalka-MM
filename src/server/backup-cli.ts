import { backupSqliteDatabase } from './backup.js';
import { getRuntimeConfig } from './config.js';

const config = getRuntimeConfig();
if (config.databaseMode !== 'sqlite') throw new Error('backup:db currently supports SQLite mode only.');

const target = backupSqliteDatabase(config.sqlitePath);
console.log(`Created SQLite backup: ${target}`);
