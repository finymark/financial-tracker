import { createHash, randomUUID } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
} from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import type {
  ProfileBackup,
  ProfileInfo,
  ProfileSummary,
  RestoreBackupInput,
} from '../../shared/profiles'
import type {
  Category,
  CategoryKind,
  CreateCategoryInput,
  RenameCategoryInput,
  ReorderCategoryInput,
  DeleteCategoryInput,
} from '../../shared/categories'
import { validateCategoryKind } from './category-validation'
import { CATEGORIES_SCHEMA_SQL } from './category-schema'
import {
  listCategories,
  createCategory,
  renameCategory,
  archiveCategory,
  unarchiveCategory,
  reorderCategory,
  deleteCategory,
  hasCategoryTransactions,
} from './profile-categories'
import { openDatabase } from '../db'
import {
  createStartupBackup,
  listBackupFiles,
  verifySqliteBackup,
} from './profile-backups'
import type {
  Account,
  CreateAccountInput,
  RenameAccountInput,
  ChangeAccountCurrencyInput,
} from '../../shared/accounts'
import type {
  ProfileSettings,
  ProfileSettingsChanges,
} from '../../shared/settings'
import type { ProfilePaths } from './profile-registry'
import { parseSettingsChanges } from './profile-settings'
import type {
  CreateTransactionInput,
  Payee,
  TransactionListInput,
  TransactionPage,
  Transaction,
  UpdateTransactionInput,
} from '../../shared/transactions'
import { listPayees, listTransactions } from './profile-transactions'
import {
  createTransactionUndoableCommand,
  deleteTransactionUndoableCommand,
  updateTransactionUndoableCommand,
} from './transaction-undo'
import {
  archiveAccount,
  changeAccountCurrency,
  createAccount,
  deleteAccount,
  getAccountBalance,
  hasAccountTransactions,
  listAccounts,
  renameAccount,
} from './profile-accounts'
import { formatBackupTimestamp } from './backup-timestamp'
import { UndoHistory, type UndoableCommand } from './undo-history'

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

const ACCOUNTS_SCHEMA_SQL = `
  CREATE TABLE accounts (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
    currency TEXT NOT NULL CHECK (currency IN ('HUF', 'CHF')),
    opening_balance INTEGER NOT NULL CHECK (
      typeof(opening_balance) = 'integer' AND
      opening_balance BETWEEN -9007199254740991 AND 9007199254740991
    ),
    opening_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1))
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
  createStartupBackup?: boolean
}

export interface ProfileQueries {
  listTransactions(input?: TransactionListInput): TransactionPage
  listPayees(): Payee[]
  hasCategoryTransactions(id: string): boolean
  listCategories(): Category[]
  listCategoryOptions(kind: CategoryKind): Category[]
  listBackups(): ProfileBackup[]
  getProfileInfo(): ProfileInfo
  listAccounts(): Account[]
  listAccountOptions(): Account[]
  getAccountBalance(id: string): number
  hasAccountTransactions(id: string): boolean
  getSettings(): ProfileSettings
}

export interface ProfileCommands {
  createTransaction(input: CreateTransactionInput): Transaction
  updateTransaction(input: UpdateTransactionInput): Transaction
  deleteTransaction(id: string): void
  undoLast(): boolean
  createCategory(input: CreateCategoryInput): Category
  renameCategory(input: RenameCategoryInput): Category
  archiveCategory(id: string): void
  unarchiveCategory(id: string): void
  reorderCategory(input: ReorderCategoryInput): void
  deleteCategory(input: DeleteCategoryInput): void
  restoreBackup(input: RestoreBackupInput): Promise<void>
  ensureProfileIdentity(): void
  createAccount(input: CreateAccountInput): Account
  renameAccount(input: RenameAccountInput): Account
  changeAccountCurrency(input: ChangeAccountCurrencyInput): Account
  archiveAccount(id: string): void
  deleteAccount(id: string): void
  updateSettings(changes: ProfileSettingsChanges): ProfileSettings
}

export interface ProfileApplication {
  readonly commands: ProfileCommands
  readonly queries: ProfileQueries
  close(): void
}

export class NewerSchemaError extends Error {
  readonly actualVersion: number
  readonly supportedVersion: number

  constructor(actualVersion: number, supportedVersion: number) {
    super('profiles.error.newerSchema')
    this.name = 'NewerSchemaError'
    this.actualVersion = actualVersion
    this.supportedVersion = supportedVersion
  }
}

export class MigrationError extends Error {
  readonly backupPath: string | null
  readonly migrationVersion: number
  readonly migrationName: string

  constructor(
    migration: SchemaMigration,
    backupPath: string | null,
    cause: unknown,
  ) {
    super('profiles.error.migration', { cause })
    this.name = 'MigrationError'
    this.backupPath = backupPath
    this.migrationVersion = migration.version
    this.migrationName = migration.name
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
  defineSqlMigration(
    2,
    'profile settings',
    `
    CREATE TABLE profile_settings (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      language TEXT NOT NULL CHECK (language IN ('hu', 'en', 'de')),
      theme TEXT NOT NULL CHECK (theme IN ('light', 'dark', 'system')),
      base_currency TEXT NOT NULL CHECK (base_currency IN ('HUF', 'CHF'))
    );
    INSERT INTO profile_settings (id, language, theme, base_currency)
    VALUES (1, 'en', 'system', 'HUF');
  `,
  ),
  defineSqlMigration(3, 'accounts', ACCOUNTS_SCHEMA_SQL),
  defineSqlMigration(
    4,
    'two-level categories with translated defaults',
    CATEGORIES_SCHEMA_SQL,
  ),
  defineSqlMigration(
    5,
    'transactions and payees',
    `
    CREATE TABLE payees (
      id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
      name TEXT NOT NULL COLLATE NOCASE CHECK (length(trim(name)) BETWEEN 1 AND 100),
      created_at TEXT NOT NULL,
      UNIQUE (name)
    );
    CREATE TABLE transactions (
      id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
      account_id TEXT NOT NULL REFERENCES accounts(id),
      kind TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
      date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      total_minor INTEGER NOT NULL CHECK (
        typeof(total_minor) = 'integer' AND total_minor BETWEEN 1 AND 9007199254740991
      ),
      payee_id TEXT REFERENCES payees(id),
      note TEXT NOT NULL CHECK (length(note) <= 1000),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX transactions_account_id ON transactions(account_id);
    CREATE TABLE transaction_lines (
      id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
      transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      amount_minor INTEGER NOT NULL CHECK (
        typeof(amount_minor) = 'integer' AND amount_minor BETWEEN 1 AND 9007199254740991
      ),
      category_id TEXT REFERENCES categories(id)
    );
    CREATE INDEX transaction_lines_transaction_id ON transaction_lines(transaction_id);
    CREATE INDEX transaction_lines_category_id ON transaction_lines(category_id);
  `,
  ),
  defineSqlMigration(
    6,
    'transaction list filter indexes',
    `
    CREATE INDEX transactions_newest ON transactions(date DESC, created_at DESC, id DESC);
    CREATE INDEX transactions_account_newest ON transactions(account_id, date DESC, created_at DESC, id DESC);
    CREATE INDEX transactions_payee_newest ON transactions(payee_id, date DESC, created_at DESC, id DESC);
    CREATE INDEX categories_parent_id ON categories(parent_id);
  `,
  ),
  defineSqlMigration(
    7,
    'Unicode-normalized payee keys',
    `
    ALTER TABLE payees ADD COLUMN normalized_name TEXT;
    UPDATE payees SET normalized_name = payee_key(name);
    UPDATE transactions
    SET payee_id = (
      SELECT canonical.id
      FROM payees AS canonical
      WHERE canonical.normalized_name = (
        SELECT duplicate.normalized_name FROM payees AS duplicate
        WHERE duplicate.id = transactions.payee_id
      )
      ORDER BY canonical.created_at, canonical.rowid
      LIMIT 1
    )
    WHERE payee_id IS NOT NULL;
    DELETE FROM payees
    WHERE id NOT IN (
      SELECT canonical.id
      FROM payees AS canonical
      WHERE canonical.rowid = (
        SELECT candidate.rowid FROM payees AS candidate
        WHERE candidate.normalized_name = canonical.normalized_name
        ORDER BY candidate.created_at, candidate.rowid
        LIMIT 1
      )
    );
    CREATE UNIQUE INDEX payees_normalized_name ON payees(normalized_name);
    CREATE TRIGGER payees_normalized_name_insert BEFORE INSERT ON payees
    WHEN NEW.normalized_name IS NULL OR NEW.normalized_name <> payee_key(NEW.name)
      BEGIN SELECT RAISE(ABORT, 'Invalid normalized payee name'); END;
    CREATE TRIGGER payees_normalized_name_update BEFORE UPDATE OF name, normalized_name ON payees
    WHEN NEW.normalized_name IS NULL OR NEW.normalized_name <> payee_key(NEW.name)
      BEGIN SELECT RAISE(ABORT, 'Invalid normalized payee name'); END;
  `,
  ),
  defineSqlMigration(
    8,
    'excluded transactions',
    `
    ALTER TABLE transactions ADD COLUMN excluded INTEGER NOT NULL DEFAULT 0 CHECK (excluded IN (0, 1));
  `,
  ),
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

async function createVerifiedBackup(
  database: Database.Database,
  paths: ProfilePaths,
  currentVersion: number,
  clock: () => Date,
): Promise<string> {
  mkdirSync(paths.preMigrationBackupDirectory, { recursive: true })
  let backupPath = join(
    paths.preMigrationBackupDirectory,
    `${formatBackupTimestamp(clock())}-v${currentVersion}.sqlite`,
  )
  let suffix = 1
  while (existsSync(backupPath)) {
    backupPath = join(
      paths.preMigrationBackupDirectory,
      `${formatBackupTimestamp(clock())}-v${currentVersion}-${suffix}.sqlite`,
    )
    suffix += 1
  }

  try {
    await database.backup(backupPath)
    const backup = openDatabase(backupPath, {
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
  #database: Database.Database
  readonly #options: OpenProfileApplicationOptions
  #restoring = false
  readonly #profile: ProfileSummary
  readonly #clock: () => Date
  readonly #undoHistory = new UndoHistory()

  constructor(
    database: Database.Database,
    options: OpenProfileApplicationOptions,
  ) {
    this.#database = database
    this.#profile = { ...options.profile }
    this.#options = options
    this.#clock = options.clock ?? (() => new Date())
    this.commands = {
      createTransaction: (input) =>
        this.#executeUndoableCommand(
          createTransactionUndoableCommand(this.#database, input, this.#clock),
        ),
      updateTransaction: (input) =>
        this.#executeUndoableCommand(
          updateTransactionUndoableCommand(this.#database, input, this.#clock),
        ),
      deleteTransaction: (id) =>
        this.#executeUndoableCommand(
          deleteTransactionUndoableCommand(this.#database, id),
        ),
      undoLast: () => {
        this.#assertAvailable()
        return this.#undoHistory.undoLast(this.#database)
      },
      deleteCategory: (input) =>
        this.#executeCommand(() => deleteCategory(this.#database, input)),
      reorderCategory: (input) =>
        this.#executeCommand(() => reorderCategory(this.#database, input)),
      archiveCategory: (id) =>
        this.#executeCommand(() => archiveCategory(this.#database, id)),
      unarchiveCategory: (id) =>
        this.#executeCommand(() => unarchiveCategory(this.#database, id)),
      createCategory: (input) =>
        this.#executeCommand(() => {
          const id = createCategory(this.#database, input)
          return this.queries
            .listCategories()
            .find((category) => category.id === id)!
        }),
      renameCategory: (input) =>
        this.#executeCommand(() => {
          const id = renameCategory(this.#database, input)
          return this.queries
            .listCategories()
            .find((category) => category.id === id)!
        }),
      restoreBackup: (input) => this.#restoreBackup(input),
      ensureProfileIdentity: () => this.#ensureProfileIdentity(),
      createAccount: (input) =>
        this.#executeCommand(() =>
          createAccount(this.#database, input, this.#clock),
        ),
      renameAccount: (input) =>
        this.#executeCommand(() => renameAccount(this.#database, input)),
      changeAccountCurrency: (input) =>
        this.#executeCommand(() =>
          changeAccountCurrency(this.#database, input),
        ),
      archiveAccount: (id) =>
        this.#executeCommand(() => archiveAccount(this.#database, id)),
      deleteAccount: (id) =>
        this.#executeCommand(() => deleteAccount(this.#database, id)),
      updateSettings: (changes) => this.#updateSettings(changes),
    }
    this.queries = {
      listTransactions: (input) => {
        this.#assertAvailable()
        return listTransactions(this.#database, input, this.#clock)
      },
      listPayees: () => {
        this.#assertAvailable()
        return listPayees(this.#database)
      },
      hasCategoryTransactions: (id) => {
        this.#assertAvailable()
        return hasCategoryTransactions(this.#database, id)
      },
      listCategoryOptions: (kind) => {
        const validatedKind = validateCategoryKind(kind)
        const categories = this.queries.listCategories()
        return categories.filter(
          (category) =>
            category.kind === validatedKind &&
            !category.archived &&
            (category.parentId === null ||
              !categories.find((parent) => parent.id === category.parentId)!
                .archived),
        )
      },
      listCategories: () => {
        this.#assertAvailable()
        return listCategories(this.#database, this.#getSettings().language)
      },
      listBackups: () => {
        this.#assertAvailable()
        return listBackupFiles(options.paths.backupDirectory).map(
          ({ id, createdAt }) => ({ id, createdAt }),
        )
      },
      getProfileInfo: () => this.#getProfileInfo(),
      getSettings: () => this.#getSettings(),
      listAccounts: () => {
        this.#assertAvailable()
        return listAccounts(this.#database)
      },
      listAccountOptions: () => {
        this.#assertAvailable()
        return listAccounts(this.#database, true)
      },
      getAccountBalance: (id) => {
        this.#assertAvailable()
        return getAccountBalance(this.#database, id)
      },
      hasAccountTransactions: (id) => {
        this.#assertAvailable()
        return hasAccountTransactions(this.#database, id)
      },
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
        throw new Error('profiles.error.identity')
      }
    })
  }

  #validateIdentity(database: Database.Database): void {
    const identity = database
      .prepare('SELECT id, created_at AS createdAt FROM profile_identity')
      .get() as { id: string; createdAt: string } | undefined
    if (
      identity?.id !== this.#profile.id ||
      identity.createdAt !== this.#profile.createdAt
    ) {
      throw new Error('backups.error.foreign')
    }
  }

  #assertAvailable(): void {
    if (this.#restoring) throw new Error('Profile restore is in progress')
    if (!this.#database.open) throw new Error('Profile is closed')
  }

  async #restoreBackup(input: RestoreBackupInput): Promise<void> {
    this.#assertAvailable()
    if (input.confirmed !== true) throw new Error('backups.error.confirmation')
    const { paths } = this.#options
    const backup = listBackupFiles(paths.backupDirectory).find(
      (candidate) => candidate.id === input.backupId,
    )
    if (!backup) throw new Error('backups.error.notFound')
    // File replacement bypasses the in-database command boundary, so even a
    // later restore failure invalidates images tied to the previous connection.
    this.#undoHistory.clear()
    const migrations = validateMigrations(
      this.#options.migrations ?? CURRENT_MIGRATIONS,
    )
    const stagedPath = join(
      paths.profileDirectory,
      `.restore-${randomUUID()}.sqlite`,
    )
    const recoveryPath = join(
      paths.profileDirectory,
      `.restore-recovery-${randomUUID()}.sqlite`,
    )
    this.#restoring = true
    let recoveryNeeded = false
    try {
      try {
        copyFileSync(join(paths.backupDirectory, backup.filename), stagedPath)
        verifySqliteBackup(stagedPath, (database) => {
          validateAppliedMigrations(readAppliedMigrations(database), migrations)
          this.#validateIdentity(database)
        })
      } catch (error) {
        if (error instanceof NewerSchemaError) {
          throw new Error('backups.error.newerSchema', { cause: error })
        }
        if (
          error instanceof Error &&
          error.message === 'backups.error.foreign'
        ) {
          throw error
        }
        throw new Error('backups.error.invalid', { cause: error })
      }
      // Restore is a file lifecycle operation, not an in-database write transaction.
      // Keep an online recovery snapshot until the replacement has reopened successfully.
      await this.#database.backup(recoveryPath)
      verifySqliteBackup(recoveryPath, () => {})
      this.#database.close()
      recoveryNeeded = true
      try {
        rmSync(`${paths.databasePath}-wal`, { force: true })
        rmSync(`${paths.databasePath}-shm`, { force: true })
        renameSync(stagedPath, paths.databasePath)
        this.#database = await openProfileDatabase(this.#options)
        this.#validateIdentity(this.#database)
        recoveryNeeded = false
      } catch (error) {
        try {
          if (this.#database.open) this.#database.close()
          rmSync(`${paths.databasePath}-wal`, { force: true })
          rmSync(`${paths.databasePath}-shm`, { force: true })
          copyFileSync(recoveryPath, stagedPath)
          renameSync(stagedPath, paths.databasePath)
          this.#database = openDatabase(paths.databasePath)
          recoveryNeeded = false
        } catch (recoveryError) {
          throw new AggregateError(
            [error, recoveryError],
            'backups.error.recovery',
          )
        }
        throw new Error('backups.error.restore', { cause: error })
      }
    } finally {
      this.#restoring = false
      rmSync(stagedPath, { force: true })
      if (!recoveryNeeded) rmSync(recoveryPath, { force: true })
    }
  }

  close(): void {
    if (this.#restoring) throw new Error('Profile restore is in progress')
    this.#undoHistory.clear()
    if (this.#database.open) this.#database.close()
  }

  #executeCommand<Result>(command: () => Result): Result {
    this.#assertAvailable()
    const result = this.#database.transaction(command)()
    // Commands without an aggregate declaration cannot safely be crossed by
    // undo. New undoable command families should use UndoHistory.execute.
    this.#undoHistory.clear()
    return result
  }

  #executeUndoableCommand<BeforeImage, AfterImage, Result>(
    command: UndoableCommand<BeforeImage, AfterImage, Result>,
  ): Result {
    this.#assertAvailable()
    return this.#undoHistory.execute(this.#database, command)
  }

  #updateSettings(changes: ProfileSettingsChanges): ProfileSettings {
    return this.#executeCommand(() => {
      const settings = {
        ...this.#getSettings(),
        ...parseSettingsChanges(changes),
      }
      this.#database
        .prepare(
          'UPDATE profile_settings SET language = ?, theme = ?, base_currency = ? WHERE id = 1',
        )
        .run(settings.language, settings.theme, settings.baseCurrency)
      return this.#getSettings()
    })
  }

  #getSettings(): ProfileSettings {
    this.#assertAvailable()
    return this.#database
      .prepare(
        'SELECT language, theme, base_currency AS baseCurrency FROM profile_settings WHERE id = 1',
      )
      .get() as ProfileSettings
  }

  #getProfileInfo(): ProfileInfo {
    this.#assertAvailable()
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

async function openProfileDatabase(
  options: OpenProfileApplicationOptions,
): Promise<Database.Database> {
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

    return database
  } catch (error) {
    if (database.open) database.close()
    throw error
  }
}

export async function openProfileApplication(
  options: OpenProfileApplicationOptions,
): Promise<ProfileApplication> {
  const database = await openProfileDatabase(options)
  const application = new OpenProfileApplication(database, options)
  try {
    application.commands.ensureProfileIdentity()
    if (options.createStartupBackup !== false) {
      await createStartupBackup(
        database,
        options.paths.backupDirectory,
        options.clock ?? (() => new Date()),
      )
    }
    return application
  } catch (error) {
    application.close()
    throw error
  }
}
