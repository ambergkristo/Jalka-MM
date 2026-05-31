import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { backupSqliteDatabase } from '../server/backup.js';
import { getRuntimeConfig, requireDestructiveConfirmation } from '../server/config.js';

describe('runtime config', () => {
  it('loads local defaults with a documented unsafe session secret', () => {
    const config = getRuntimeConfig({ APP_ENV: 'local' });
    expect(config.appEnv).toBe('local');
    expect(config.databaseMode).toBe('sqlite');
    expect(config.sessionSecret).toBe('local-dev-session-secret-change-me');
  });

  it('requires session secret in production', () => {
    expect(() => getRuntimeConfig({ APP_ENV: 'production' })).toThrow(/SESSION_SECRET/);
    expect(getRuntimeConfig({ APP_ENV: 'production', SESSION_SECRET: 'session-secret', DATABASE_MODE: 'postgres', DATABASE_URL: 'postgres://example' }).sessionSecret).toBe('session-secret');
  });

  it('selects postgres and requires DATABASE_URL', () => {
    expect(getRuntimeConfig({ APP_ENV: 'staging', DATABASE_MODE: 'postgres', DATABASE_URL: 'postgres://example' }).databaseMode).toBe('postgres');
    expect(() => getRuntimeConfig({ APP_ENV: 'staging', DATABASE_MODE: 'postgres' })).toThrow(/DATABASE_URL/);
  });

  it('refuses production sqlite unless explicitly overridden', () => {
    expect(() => getRuntimeConfig({ APP_ENV: 'production', SESSION_SECRET: 'session-secret', DATABASE_MODE: 'sqlite' })).toThrow(/Production mode requires/);
    expect(getRuntimeConfig({ APP_ENV: 'production', SESSION_SECRET: 'session-secret', DATABASE_MODE: 'sqlite', ALLOW_UNSAFE_PRODUCTION_SQLITE: 'true' }).databaseMode).toBe('sqlite');
  });

  it('refuses destructive confirmation in production mode', () => {
    const config = getRuntimeConfig({ APP_ENV: 'production', SESSION_SECRET: 'session-secret', DATABASE_MODE: 'postgres', DATABASE_URL: 'postgres://example' });
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
