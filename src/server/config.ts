import { join } from 'node:path';

export type AppEnv = 'local' | 'staging' | 'production';
export type DatabaseMode = 'sqlite' | 'postgres';
export type TournamentDataMode = 'seeded' | 'official' | 'partial_official';

export interface RuntimeConfig {
  appEnv: AppEnv;
  databaseMode: DatabaseMode;
  sqlitePath: string;
  databaseUrl?: string;
  adminSecret?: string;
  publicAppBaseUrl: string;
  tournamentDataMode: TournamentDataMode;
  allowDestructiveCommands: boolean;
  allowUnsafeProductionSqlite: boolean;
}

const localAdminSecret = 'ADMIN2026';

export function getRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const appEnv = parseAppEnv(env.APP_ENV ?? env.WORLDCUP_MODE ?? 'local');
  const databaseMode = parseDatabaseMode(env.DATABASE_MODE ?? (env.DATABASE_URL ? 'postgres' : 'sqlite'));
  const adminSecret = env.ADMIN_SECRET ?? env.ADMIN_PIN ?? (appEnv === 'local' ? localAdminSecret : undefined);
  if (appEnv === 'production' && !adminSecret) throw new Error('ADMIN_SECRET is required in production mode');
  if (databaseMode === 'postgres' && !env.DATABASE_URL) throw new Error('DATABASE_URL is required when DATABASE_MODE=postgres');
  const allowUnsafeProductionSqlite = env.ALLOW_UNSAFE_PRODUCTION_SQLITE === 'true';
  if (appEnv === 'production' && databaseMode === 'sqlite' && !allowUnsafeProductionSqlite) {
    throw new Error('Production mode requires DATABASE_MODE=postgres unless ALLOW_UNSAFE_PRODUCTION_SQLITE=true');
  }

  return {
    appEnv,
    databaseMode,
    sqlitePath: env.SQLITE_DB_PATH ?? env.WORLDCUP_DB_PATH ?? join(process.cwd(), 'data', 'worldcup2026.sqlite'),
    databaseUrl: env.DATABASE_URL,
    adminSecret,
    publicAppBaseUrl: env.PUBLIC_APP_BASE_URL ?? 'http://localhost:5174',
    tournamentDataMode: parseTournamentDataMode(env.TOURNAMENT_DATA_MODE ?? 'partial_official'),
    allowDestructiveCommands: env.ALLOW_DESTRUCTIVE_COMMANDS === 'true' || env.ALLOW_PRODUCTION_RESET === 'true',
    allowUnsafeProductionSqlite
  };
}

export function requireDestructiveConfirmation(config: RuntimeConfig, confirmation?: string): void {
  if (config.appEnv === 'production') throw new Error('Destructive reset refused in production mode.');
  if (confirmation !== 'DELETE_LOCAL_DATA' && !config.allowDestructiveCommands) {
    throw new Error('Destructive reset refused. Pass --confirm=DELETE_LOCAL_DATA or set ALLOW_DESTRUCTIVE_COMMANDS=true.');
  }
}

function parseAppEnv(value: string): AppEnv {
  if (value === 'local' || value === 'staging' || value === 'production') return value;
  throw new Error(`Invalid APP_ENV ${value}`);
}

function parseDatabaseMode(value: string): DatabaseMode {
  if (value === 'sqlite' || value === 'postgres') return value;
  throw new Error(`Invalid DATABASE_MODE ${value}`);
}

function parseTournamentDataMode(value: string): TournamentDataMode {
  if (value === 'seeded' || value === 'official' || value === 'partial_official') return value;
  throw new Error(`Invalid TOURNAMENT_DATA_MODE ${value}`);
}
