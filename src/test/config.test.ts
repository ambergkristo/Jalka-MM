import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { backupSqliteDatabase } from '../server/backup.js';
import { getRuntimeConfig, requireDestructiveConfirmation } from '../server/config.js';

describe('runtime config', () => {
  it('loads local defaults with an unsafe documented admin secret', () => {
    const config = getRuntimeConfig({ APP_ENV: 'local' });
    expect(config.appEnv).toBe('local');
    expect(config.databaseMode).toBe('sqlite');
    expect(config.adminSecret).toBe('ADMIN2026');
  });

  it('requires admin secret in production', () => {
    expect(() => getRuntimeConfig({ APP_ENV: 'production' })).toThrow(/ADMIN_SECRET/);
    expect(getRuntimeConfig({ APP_ENV: 'production', ADMIN_SECRET: 'secret' }).adminSecret).toBe('secret');
  });

  it('refuses destructive confirmation in production mode', () => {
    const config = getRuntimeConfig({ APP_ENV: 'production', ADMIN_SECRET: 'secret' });
    expect(() => requireDestructiveConfirmation(config, 'DELETE_LOCAL_DATA')).toThrow(/production/);
  });

  it('backs up a SQLite database file', () => {
    const root = join(tmpdir(), `wc-backup-${Date.now()}`);
    mkdirSync(root, { recursive: true });
    const dbPath = join(root, 'worldcup2026.sqlite');
    writeFileSync(dbPath, 'sqlite-bytes');
    const target = backupSqliteDatabase(dbPath, join(root, 'backups'), new Date('2026-01-01T00:00:00.000Z'));
    expect(target).toContain('worldcup2026-2026-01-01T00-00-00-000Z.sqlite');
  });
});
