import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';

export function backupSqliteDatabase(dbPath: string, backupDir = join(process.cwd(), 'backups'), now = new Date()): string {
  if (!existsSync(dbPath)) throw new Error(`SQLite database not found at ${dbPath}`);
  mkdirSync(backupDir, { recursive: true });
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const target = join(backupDir, `${basename(dbPath, '.sqlite')}-${stamp}.sqlite`);
  copyFileSync(dbPath, target);
  return target;
}
