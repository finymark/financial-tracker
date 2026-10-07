import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import type { ProfileInfo, ProfileSummary } from '../../shared/profiles'
import { openDatabase } from '../db'
import type { ProfilePaths } from './profile-registry'

const MIGRATION_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY NOT NULL CHECK (version > 0),
    name TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )
`

const INITIAL_SCHEMA_SQL = `
  CREATE TABLE profile_identity (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    created_at TEXT NOT NULL
  )
`

export interface SchemaMigration {
  readonly version: number
  readonly name: string
  readonly checksum: string
  apply(database: Database.Database): void
}

interface AppliedMigration {
  version: number
  name: string
  checksum: string
}

export interface OpenProfileApplicationOptions {
  profile: ProfileSummary
  paths: ProfilePaths
  migrations?: readonly SchemaMigration[]
  clock?: () => Date
}

export interface ProfileQueries {
  getProfileInfo(): ProfileInfo
}

export interface ProfileCommands {
  ensureProfileIdentity(): void
}

export interface ProfileApplication {
  readonly commands: ProfileCommands
  readonly queries: ProfileQueries
  close(): void
}

export class NewerSchemaError extends Error {
  constructor(actualVersion: number, supportedVersion: number) {
    super(
      `Profile schema version ${actualVersion} is newer than supported version ${supportedVersion}`,
    )
    this.name = 'NewerSchemaError'
  }
}

export class MigrationError extends Error {
  readonly backupPath: string | null

  constructor(
    migration: SchemaMigration,
    backupPath: string | null,
    cause: unknown,
  ) {
    super(`Migration ${migration.version} (${migration.name}) failed`, {
      cause,
    })
    this.name = 'MigrationError'
    this.backupPath = backupPath
  }
}

export function defineSqlMigration(
  version: number,
  name: string,
  sql: string,
): SchemaMigration {
  const checksum = createHash('sha256').update(sql, 'utf8').digest('hex')
  return {
    version,
    name,
    checksum,
    apply(database) {
      database.exec(sql)
    },
  }
}

export const CURRENT_MIGRATIONS: readonly SchemaMigration[] = [
  defineSqlMigration(1, 'initial profile schema', INITIAL_SCHEMA_SQL),
]

function validateMigrations(
  migrations: readonly SchemaMigration[],
): readonly SchemaMigration[] {
  if (migrations.length === 0)
    throw new Error('At least one migration is required')
  for (const [index, migration] of migrations.entries()) {
    if (
      migration.version !== index + 1 ||
      migration.name.trim().length === 0 ||
      !/^[0-9a-f]{64}$/.test(migration.checksum)
    ) {
      throw new Error('Migrations must be ordered, contiguous, and checksummed')
    }
  }
  return migrations
}

function hasMigrationTable(database: Database.Database): boolean {
  return Boolean(
    database
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
      )
      .get(),
  )
}

function readAppliedMigrations(
  database: Database.Database,
): AppliedMigration[] {
  if (!hasMigrationTable(database)) return []
  return database
    .prepare(
      'SELECT version, name, checksum FROM schema_migrations ORDER BY version',
    )
    .all() as AppliedMigration[]
}

function validateAppliedMigrations(
  applied: readonly AppliedMigration[],
  migrations: readonly SchemaMigration[],
): number {
  const currentVersion = applied.at(-1)?.version ?? 0
  const supportedVersion = migrations.at(-1)?.version ?? 0
  if (currentVersion > supportedVersion) {
    throw new NewerSchemaError(currentVersion, supportedVersion)
  }
  for (const [index, record] of applied.entries()) {
    const expected = migrations[index]
    if (
      record.version !== index + 1 ||
      !expected ||
      record.name !== expected.name ||
      record.checksum !== expected.checksum
    ) {
      throw new Error(`Schema migration record ${record.version} is invalid`)
    }
  }
  return currentVersion
}

function safeTimestamp(date: Date): string {
  return date.toISOString().replaceAll(':', '-').replaceAll('.', '-')
}

async function createVerifiedBackup(
  database: Database.Database,
  paths: ProfilePaths,
  currentVersion: number,
  clock: () => Date,
): Promise<string> {
  mkdirSync(paths.preMigrationBackupDirectory, { recursive: true })
  let backupPath = join(
    paths.preMigrationBackupDirectory,
    `${safeTimestamp(clock())}-v${currentVersion}.sqlite`,
  )
  let suffix = 1
  while (existsSync(backupPath)) {
    backupPath = join(
      paths.preMigrationBackupDirectory,
      `${safeTimestamp(clock())}-v${currentVersion}-${suffix}.sqlite`,
    )
    suffix += 1
  }

  try {
    await database.backup(backupPath)
    const backup = new Database(backupPath, {
      readonly: true,
      fileMustExist: true,
    })
    try {
      if (backup.pragma('quick_check', { simple: true }) !== 'ok') {
        throw new Error('SQLite quick_check failed for the migration backup')
      }
      const backupVersion = readAppliedMigrations(backup).at(-1)?.version ?? 0
      if (backupVersion !== currentVersion) {
        throw new Error(
          'Migration backup schema version does not match its source',
        )
      }
    } finally {
      backup.close()
    }
    return backupPath
  } catch (error) {
    rmSync(backupPath, { force: true })
    throw new Error('Could not create and verify the pre-migration backup', {
      cause: error,
    })
  }
}

function removeDatabaseFiles(databasePath: string): void {
  for (const path of [
    databasePath,
    `${databasePath}-wal`,
    `${databasePath}-shm`,
  ]) {
    rmSync(path, { force: true })
  }
}

class OpenProfileApplication implements ProfileApplication {
  readonly commands: ProfileCommands
  readonly queries: ProfileQueries
  readonly #database: Database.Database
  readonly #profile: ProfileSummary

  constructor(database: Database.Database, profile: ProfileSummary) {
    this.#database = database
    this.#profile = { ...profile }
    this.commands = {
      ensureProfileIdentity: () => this.#ensureProfileIdentity(),
    }
    this.queries = {
      getProfileInfo: () => this.#getProfileInfo(),
    }
  }

  #ensureProfileIdentity(): void {
    this.#executeCommand(() => {
      const identity = this.#database
        .prepare('SELECT id, created_at AS createdAt FROM profile_identity')
        .get() as { id: string; createdAt: string } | undefined
      if (!identity) {
        this.#database
          .prepare(
            'INSERT INTO profile_identity (id, created_at) VALUES (?, ?)',
          )
          .run(this.#profile.id, this.#profile.createdAt)
        return
      }
      if (
        identity.id !== this.#profile.id ||
        identity.createdAt !== this.#profile.createdAt
      ) {
        throw new Error('Profile database identity does not match the registry')
      }
    })
  }

  close(): void {
    if (this.#database.open) this.#database.close()
  }

  #executeCommand<Result>(command: () => Result): Result {
    return this.#database.transaction(command)()
  }

  #getProfileInfo(): ProfileInfo {
    const identity = this.#database
      .prepare('SELECT id, created_at AS createdAt FROM profile_identity')
      .get() as { id: string; createdAt: string }
    const schemaVersion =
      readAppliedMigrations(this.#database).at(-1)?.version ?? 0
    return {
      id: identity.id,
      name: this.#profile.name,
      createdAt: identity.createdAt,
      schemaVersion,
    }
  }
}

export async function openProfileApplication(
  options: OpenProfileApplicationOptions,
): Promise<ProfileApplication> {
  const migrations = validateMigrations(
    options.migrations ?? CURRENT_MIGRATIONS,
  )
  const clock = options.clock ?? (() => new Date())
  mkdirSync(options.paths.dataDirectory, { recursive: true })
  mkdirSync(options.paths.preMigrationBackupDirectory, { recursive: true })
  const existingDatabase = existsSync(options.paths.databasePath)
  const database = openDatabase(options.paths.databasePath)
  let backupPath: string | null = null

  try {
    const applied = readAppliedMigrations(database)
    const currentVersion = validateAppliedMigrations(applied, migrations)
    const pending = migrations.slice(currentVersion)
    if (pending.length > 0 && existingDatabase) {
      backupPath = await createVerifiedBackup(
        database,
        options.paths,
        currentVersion,
        clock,
      )
    }

    for (const migration of pending) {
      try {
        database.transaction(() => {
          database.exec(MIGRATION_TABLE_SQL)
          migration.apply(database)
          database
            .prepare(
              'INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)',
            )
            .run(
              migration.version,
              migration.name,
              migration.checksum,
              clock().toISOString(),
            )
        })()
      } catch (error) {
        database.close()
        if (backupPath) {
          removeDatabaseFiles(options.paths.databasePath)
          copyFileSync(backupPath, options.paths.databasePath)
        } else {
          removeDatabaseFiles(options.paths.databasePath)
        }
        throw new MigrationError(migration, backupPath, error)
      }
    }

    const application = new OpenProfileApplication(database, options.profile)
    application.commands.ensureProfileIdentity()
    return application
  } catch (error) {
    if (database.open) database.close()
    throw error
  }
}
