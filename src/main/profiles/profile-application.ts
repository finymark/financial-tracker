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
import {
  validateAccountId,
  validateAccountName,
  validateAccountCurrency,
  validateOpeningBalance,
  validateOpeningDate,
} from './account-validation'
import type { ProfilePaths } from './profile-registry'
import { parseSettingsChanges } from './profile-settings'
import type {
  CreateTransactionInput,
  Payee,
  Transaction,
  UpdateTransactionInput,
} from '../../shared/transactions'
import {
  createTransaction,
  deleteTransaction,
  listPayees,
  listTransactions,
  updateTransaction,
} from './profile-transactions'

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

interface StoredAccount extends CreateAccountInput {
  id: string
  createdAt: string
  archived: number
}

const ACCOUNT_COLUMNS = `id, name, currency, opening_balance AS openingBalance,
  opening_date AS openingDate, created_at AS createdAt, archived`

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
  listTransactions(): Transaction[]
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
  createCategory(input: CreateCategoryInput): Category
  renameCategory(input: RenameCategoryInput): Category
  archiveCategory(id: string): void
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
  #database: Database.Database
  readonly #options: OpenProfileApplicationOptions
  #restoring = false
  readonly #profile: ProfileSummary
  readonly #clock: () => Date

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
        this.#executeCommand(() =>
          createTransaction(this.#database, input, this.#clock),
        ),
      updateTransaction: (input) =>
        this.#executeCommand(() =>
          updateTransaction(this.#database, input, this.#clock),
        ),
      deleteTransaction: (id) =>
        this.#executeCommand(() => deleteTransaction(this.#database, id)),
      deleteCategory: (input) =>
        this.#executeCommand(() => deleteCategory(this.#database, input)),
      reorderCategory: (input) =>
        this.#executeCommand(() => reorderCategory(this.#database, input)),
      archiveCategory: (id) =>
        this.#executeCommand(() => archiveCategory(this.#database, id)),
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
      createAccount: (input) => this.#createAccount(input),
      renameAccount: (input) => this.#renameAccount(input),
      changeAccountCurrency: (input) => this.#changeAccountCurrency(input),
      archiveAccount: (id) => this.#archiveAccount(id),
      deleteAccount: (id) => this.#deleteAccount(id),
      updateSettings: (changes) => this.#updateSettings(changes),
    }
    this.queries = {
      listTransactions: () => {
        this.#assertAvailable()
        return listTransactions(this.#database)
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
      listAccounts: () => this.#listAccounts(),
      listAccountOptions: () => this.#listAccounts(true),
      getAccountBalance: (id) => this.#getAccountBalance(id),
      hasAccountTransactions: (id) => this.#hasAccountTransactions(id),
    }
  }

  #createAccount(input: CreateAccountInput): Account {
    return this.#executeCommand(() => {
      const name = validateAccountName(input.name)
      const currency = validateAccountCurrency(input.currency)
      const openingBalance = validateOpeningBalance(input.openingBalance)
      const openingDate = validateOpeningDate(input.openingDate)
      const id = randomUUID()
      this.#database
        .prepare(
          `INSERT INTO accounts
        (id, name, currency, opening_balance, opening_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          name,
          currency,
          openingBalance,
          openingDate,
          this.#clock().toISOString(),
        )
      return this.#accountView(this.#getAccount(id))
    })
  }

  #renameAccount(input: RenameAccountInput): Account {
    return this.#executeCommand(() => {
      const account = this.#getAccount(input.id)
      const name = validateAccountName(input.name)
      this.#database
        .prepare('UPDATE accounts SET name = ? WHERE id = ?')
        .run(name, account.id)
      return this.#accountView(this.#getAccount(account.id))
    })
  }

  #changeAccountCurrency(input: ChangeAccountCurrencyInput): Account {
    return this.#executeCommand(() => {
      const account = this.#getAccount(input.id)
      const currency = validateAccountCurrency(input.currency)
      if (
        currency !== account.currency &&
        this.#hasAccountTransactions(account.id)
      ) {
        throw new Error('accounts.error.currencyLocked')
      }
      this.#database
        .prepare('UPDATE accounts SET currency = ? WHERE id = ?')
        .run(currency, account.id)
      return this.#accountView(this.#getAccount(account.id))
    })
  }

  #archiveAccount(id: string): void {
    this.#executeCommand(() => {
      const account = this.#getAccount(id)
      this.#database
        .prepare('UPDATE accounts SET archived = 1 WHERE id = ?')
        .run(account.id)
    })
  }

  #deleteAccount(id: string): void {
    this.#executeCommand(() => {
      const account = this.#getAccount(id)
      if (this.#hasAccountTransactions(account.id)) {
        throw new Error('accounts.error.notEmpty')
      }
      this.#database
        .prepare('DELETE FROM accounts WHERE id = ?')
        .run(account.id)
    })
  }

  #getAccount(id: string): StoredAccount {
    this.#assertAvailable()
    const account = this.#database
      .prepare(`SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE id = ?`)
      .get(validateAccountId(id)) as StoredAccount | undefined
    if (!account) throw new Error('accounts.error.notFound')
    return account
  }

  #listAccounts(activeOnly = false): Account[] {
    this.#assertAvailable()
    const accounts = this.#database
      .prepare(
        `SELECT ${ACCOUNT_COLUMNS} FROM accounts ${activeOnly ? 'WHERE archived = 0' : ''} ORDER BY created_at, rowid`,
      )
      .all() as StoredAccount[]
    return accounts.map((account) => this.#accountView(account))
  }

  #accountView(account: StoredAccount): Account {
    return {
      ...account,
      archived: Boolean(account.archived),
      balance: this.#getAccountBalance(account.id),
      hasTransactions: this.#hasAccountTransactions(account.id),
    }
  }

  #getAccountBalance(id: string): number {
    const account = this.#getAccount(id)
    const totals = this.#database
      .prepare(
        `SELECT COALESCE(SUM(
          CASE kind WHEN 'income' THEN total_minor ELSE -total_minor END
        ), 0) AS total FROM transactions WHERE account_id = ?`,
      )
      .get(account.id) as { total: number }
    const balance = account.openingBalance + totals.total
    if (!Number.isSafeInteger(balance))
      throw new Error('accounts.error.balance')
    return balance
  }

  #hasAccountTransactions(id: string): boolean {
    const account = this.#getAccount(id)
    return Boolean(
      this.#database
        .prepare('SELECT 1 FROM transactions WHERE account_id = ? LIMIT 1')
        .get(account.id),
    )
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

  #validateIdentity(database: Database.Database): void {
    const identity = database
      .prepare('SELECT id, created_at AS createdAt FROM profile_identity')
      .get() as { id: string; createdAt: string } | undefined
    if (
      identity?.id !== this.#profile.id ||
      identity.createdAt !== this.#profile.createdAt
    ) {
      throw new Error('Backup does not belong to this profile')
    }
  }

  #assertAvailable(): void {
    if (this.#restoring) throw new Error('Profile restore is in progress')
    if (!this.#database.open) throw new Error('Profile is closed')
  }

  async #restoreBackup(input: RestoreBackupInput): Promise<void> {
    this.#assertAvailable()
    if (input.confirmed !== true)
      throw new Error('Backup restore requires confirmation')
    const { paths } = this.#options
    const backup = listBackupFiles(paths.backupDirectory).find(
      (candidate) => candidate.id === input.backupId,
    )
    if (!backup) throw new Error('Backup not found in this profile')
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
      copyFileSync(join(paths.backupDirectory, backup.filename), stagedPath)
      verifySqliteBackup(stagedPath, (database) => {
        validateAppliedMigrations(readAppliedMigrations(database), migrations)
        this.#validateIdentity(database)
      })
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
            `Restore recovery failed; the previous database is preserved at ${recoveryPath}`,
          )
        }
        throw new Error(
          'Could not restore backup; the previous database was reopened',
          { cause: error },
        )
      }
    } finally {
      this.#restoring = false
      rmSync(stagedPath, { force: true })
      if (!recoveryNeeded) rmSync(recoveryPath, { force: true })
    }
  }

  close(): void {
    if (this.#restoring) throw new Error('Profile restore is in progress')
    if (this.#database.open) this.#database.close()
  }

  #executeCommand<Result>(command: () => Result): Result {
    this.#assertAvailable()
    return this.#database.transaction(command)()
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
    await createStartupBackup(
      database,
      options.paths.backupDirectory,
      options.clock ?? (() => new Date()),
    )
    return application
  } catch (error) {
    application.close()
    throw error
  }
}
