import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import pg from 'pg';
import type { RuntimeConfig } from './config.js';

export type DatabaseProvider = 'sqlite' | 'postgres';
export type QueryValue = SQLInputValue | null;

export interface QueryableDatabase {
  provider: DatabaseProvider;
  run(sql: string, values?: QueryValue[]): Promise<void>;
  all(sql: string, values?: QueryValue[]): Promise<Record<string, unknown>[]>;
  one(sql: string, values?: QueryValue[]): Promise<Record<string, unknown> | null>;
  exec(sql: string): Promise<void>;
  transaction<T>(callback: (tx: QueryableDatabase) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function createDatabase(config: RuntimeConfig): QueryableDatabase {
  if (config.databaseMode === 'postgres') return createPostgresDatabase(config);
  return createSqliteDatabase(config.sqlitePath);
}

function createSqliteDatabase(dbPath: string): QueryableDatabase {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  return {
    provider: 'sqlite',
    async run(sql, values = []) {
      db.prepare(sql).run(...values);
    },
    async all(sql, values = []) {
      return db.prepare(sql).all(...values) as Record<string, unknown>[];
    },
    async one(sql, values = []) {
      return (db.prepare(sql).get(...values) as Record<string, unknown> | undefined) ?? null;
    },
    async exec(sql) {
      db.exec(sql);
    },
    async transaction(callback) {
      db.exec('BEGIN');
      try {
        const result = await callback(this);
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    async close() {
      db.close();
    }
  };
}

function createPostgresDatabase(config: RuntimeConfig): QueryableDatabase {
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  return {
    provider: 'postgres',
    async run(sql, values = []) {
      await pool.query(toPostgresSql(sql), values);
    },
    async all(sql, values = []) {
      const result = await pool.query(toPostgresSql(sql), values);
      return result.rows as Record<string, unknown>[];
    },
    async one(sql, values = []) {
      const result = await pool.query(toPostgresSql(sql), values);
      return (result.rows[0] as Record<string, unknown> | undefined) ?? null;
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async transaction(callback) {
      const client = await pool.connect();
      const tx: QueryableDatabase = {
        provider: 'postgres',
        async run(sql, values = []) {
          await client.query(toPostgresSql(sql), values);
        },
        async all(sql, values = []) {
          const result = await client.query(toPostgresSql(sql), values);
          return result.rows as Record<string, unknown>[];
        },
        async one(sql, values = []) {
          const result = await client.query(toPostgresSql(sql), values);
          return (result.rows[0] as Record<string, unknown> | undefined) ?? null;
        },
        async exec(sql) {
          await client.query(sql);
        },
        async transaction(innerCallback) {
          return innerCallback(tx);
        },
        async close() {}
      };
      try {
        await client.query('BEGIN');
        const result = await callback(tx);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    }
  };
}

function toPostgresSql(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}
