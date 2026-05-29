export type DatabaseProvider = 'sqlite' | 'postgres';

export interface QueryableDatabase {
  provider: DatabaseProvider;
  run(sql: string, values?: unknown[]): void;
  all(sql: string, values?: unknown[]): Record<string, unknown>[];
  one(sql: string, values?: unknown[]): Record<string, unknown> | null;
}

export interface DatabaseMigrationPlan {
  currentProvider: DatabaseProvider;
  targetProvider: 'postgres';
  steps: string[];
}

export function postgresMigrationPlan(currentProvider: DatabaseProvider): DatabaseMigrationPlan {
  return {
    currentProvider,
    targetProvider: 'postgres',
    steps: [
      'Keep domain scoring independent from database code.',
      'Move SQLite-specific SQL behind QueryableDatabase.',
      'Add Postgres migrations for users, players, matches, predictions, results, score breakdowns, leaderboard snapshots, and audit log.',
      'Run a one-time SQLite export/import rehearsal before public launch.',
      'Use managed Postgres or Supabase with automated backups for public shared URLs.'
    ]
  };
}
