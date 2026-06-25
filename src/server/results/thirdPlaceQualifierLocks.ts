import type { QueryableDatabase } from '../databaseAdapter.js';
import { migrateResultPersistenceSchema } from './resultPersistenceSchema.js';
import type { ThirdPlaceQualifierSignal } from './scoringState.js';

export type ThirdPlaceQualifierLockStatus = 'qualified';
export type ThirdPlaceQualifierLockSource = 'organizerLock';

export interface ThirdPlaceQualifierLockInput {
  group: string;
  teamId: string;
  status?: ThirdPlaceQualifierLockStatus;
  source?: ThirdPlaceQualifierLockSource;
  note?: string;
}

export interface ThirdPlaceQualifierLock {
  group: string;
  teamId: string;
  team: string;
  status: ThirdPlaceQualifierLockStatus;
  source: ThirdPlaceQualifierLockSource;
  note?: string;
  lockedAt: string;
  updatedAt: string;
}

export async function upsertThirdPlaceQualifierLock(
  db: QueryableDatabase,
  input: ThirdPlaceQualifierLockInput,
  now = new Date()
): Promise<ThirdPlaceQualifierLock> {
  await migrateResultPersistenceSchema(db);
  const group = normalizeGroup(input.group);
  const status = input.status ?? 'qualified';
  const source = input.source ?? 'organizerLock';
  if (status !== 'qualified') throw new Error(`Unsupported third-place qualifier lock status "${status}".`);
  if (source !== 'organizerLock') throw new Error(`Unsupported third-place qualifier lock source "${source}".`);

  const team = await db.one(`
    SELECT id, COALESCE(name_et, name) AS team_name, group_id
    FROM teams
    WHERE id = ?
    LIMIT 1
  `, [input.teamId]);
  if (!team) throw new Error(`Team not found: ${input.teamId}`);
  if (String(team.group_id ?? '') !== group) {
    throw new Error(`Team ${input.teamId} belongs to group ${String(team.group_id ?? 'unknown')}, not ${group}.`);
  }

  const nowIso = now.toISOString();
  await db.run(
    `INSERT INTO third_place_qualifier_locks (
      group_id, team_id, status, source, note, locked_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(group_id, team_id) DO UPDATE SET
      status = excluded.status,
      source = excluded.source,
      note = excluded.note,
      updated_at = excluded.updated_at`,
    [group, input.teamId, status, source, emptyToNull(input.note), nowIso, nowIso]
  );

  return readThirdPlaceQualifierLock(db, group, input.teamId);
}

export async function listThirdPlaceQualifierLocks(db: QueryableDatabase): Promise<ThirdPlaceQualifierLock[]> {
  await migrateResultPersistenceSchema(db);
  const rows = await db.all(`
    SELECT
      locks.group_id,
      locks.team_id,
      COALESCE(team.name_et, team.name, locks.team_id) AS team_name,
      locks.status,
      locks.source,
      locks.note,
      locks.locked_at,
      locks.updated_at
    FROM third_place_qualifier_locks locks
    LEFT JOIN teams team ON team.id = locks.team_id
    ORDER BY locks.group_id ASC, team_name ASC, locks.team_id ASC
  `);
  return rows.map(mapThirdPlaceQualifierLock);
}

export async function loadOrganizerThirdPlaceQualifierSignals(db: QueryableDatabase): Promise<ThirdPlaceQualifierSignal[]> {
  const locks = await listThirdPlaceQualifierLocks(db);
  return locks
    .filter((lock) => lock.status === 'qualified')
    .map((lock) => ({
      teamName: lock.team,
      source: 'organizerLock' as const
    }));
}

async function readThirdPlaceQualifierLock(db: QueryableDatabase, group: string, teamId: string): Promise<ThirdPlaceQualifierLock> {
  const row = await db.one(`
    SELECT
      locks.group_id,
      locks.team_id,
      COALESCE(team.name_et, team.name, locks.team_id) AS team_name,
      locks.status,
      locks.source,
      locks.note,
      locks.locked_at,
      locks.updated_at
    FROM third_place_qualifier_locks locks
    LEFT JOIN teams team ON team.id = locks.team_id
    WHERE locks.group_id = ? AND locks.team_id = ?
    LIMIT 1
  `, [group, teamId]);
  if (!row) throw new Error(`Third-place qualifier lock not found for ${group}/${teamId}.`);
  return mapThirdPlaceQualifierLock(row);
}

function mapThirdPlaceQualifierLock(row: Record<string, unknown>): ThirdPlaceQualifierLock {
  return {
    group: String(row.group_id),
    teamId: String(row.team_id),
    team: String(row.team_name ?? row.team_id),
    status: 'qualified',
    source: 'organizerLock',
    note: stringOrUndefined(row.note),
    lockedAt: String(row.locked_at),
    updatedAt: String(row.updated_at)
  };
}

function normalizeGroup(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!normalized) throw new Error('group is required.');
  return normalized;
}

function emptyToNull(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function stringOrUndefined(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return String(value);
}
