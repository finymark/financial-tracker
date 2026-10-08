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
  AccountOption,
  ListAccountOptionsInput,
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
  TransactionListInput,
  TransactionPage,
  Transaction,
  UpdateTransactionInput,
} from '../../shared/transactions'
import type {
  AddPayeeAliasInput,
  Payee,
  PayeeAlias,
  PayeeSuggestion,
  PayeeSuggestionInput,
  MergePayeesInput,
} from '../../shared/payees'
import type {
  CreateTransferInput,
  Transfer,
  UpdateTransferInput,
} from '../../shared/transfers'
import type {
  BalanceAdjustment,
  CreateBalanceAdjustmentInput,
  UpdateBalanceAdjustmentInput,
} from '../../shared/adjustments'
import { listTransactions } from './profile-transactions'
import { exportTransactionsCsv } from './profile-transaction-csv'
import type { TransactionCsvInput } from '../../shared/transaction-csv'
import { listPayeeAliases, listPayees, suggestPayees } from './profile-payees'
import {
  addPayeeAliasUndoableCommand,
  mergePayeesUndoableCommand,
  removePayeeAliasUndoableCommand,
} from './payee-undo'
import type { Tag, RenameTagInput } from '../../shared/tags'
import { renameTagUndoableCommand, deleteTagUndoableCommand } from './tag-undo'
import { listTags } from './profile-tags'
import type {
  CreateTemplateInput,
  TransactionTemplate,
  UpdateTemplateInput,
  SaveTransactionAsTemplateInput,
} from '../../shared/templates'
import { listTemplates } from './profile-templates'
import {
  createTemplateUndoableCommand,
  updateTemplateUndoableCommand,
  deleteTemplateUndoableCommand,
  saveTransactionAsTemplateUndoableCommand,
} from './template-undo'
import {
  createTransactionUndoableCommand,
  duplicateTransactionUndoableCommand,
  deleteTransactionUndoableCommand,
  updateTransactionUndoableCommand,
} from './transaction-undo'
import {
  getAccountBalance,
  hasAccountTransactions,
  listAccountOptions,
  listAccounts,
} from './profile-accounts'
import {
  archiveAccountUndoableCommand,
  changeAccountCurrencyUndoableCommand,
  createAccountUndoableCommand,
  deleteAccountUndoableCommand,
  renameAccountUndoableCommand,
  unarchiveAccountUndoableCommand,
} from './account-undo'
import { categoryUndoableCommand } from './category-undo'
import { formatBackupTimestamp } from './backup-timestamp'
import { UndoHistory, type UndoableCommand } from './undo-history'
import {
  createTransferUndoableCommand,
  deleteTransferUndoableCommand,
  updateTransferUndoableCommand,
} from './transfer-undo'
import {
  createBalanceAdjustmentUndoableCommand,
  deleteBalanceAdjustmentUndoableCommand,
  updateBalanceAdjustmentUndoableCommand,
} from './adjustment-undo'
import type {
  CategorisationAutofill,
  CategorisationRule,
  CategorisationRuleDraftInput,
  CreateCategorisationRuleInput,
  ReorderCategorisationRuleInput,
  UpdateCategorisationRuleInput,
} from '../../shared/rules'
import {
  getCategorisationAutofill,
  listCategorisationRules,
} from './profile-rules'
import {
  createCategorisationRuleUndoableCommand,
  deleteCategorisationRuleUndoableCommand,
  reorderCategorisationRuleUndoableCommand,
  updateCategorisationRuleUndoableCommand,
} from './rule-undo'
import type { ExchangeRateSource } from '../exchange-rates/exchange-rate-source'
import type {
  BaseCurrencyConversion,
  ConversionLine,
  RateStatus,
} from '../../shared/exchange-rates'
import {
  convertToBaseCurrency,
  getRateStatus,
  refreshExchangeRates as refreshProfileExchangeRates,
} from './profile-exchange-rates'
import type {
  CategoryBreakdownReport,
  SpendingPaceReport,
  MonthlyTrendReport,
  ReportDateRangeInput,
} from '../../shared/reports'
import {
  parseReportDateRangeInput,
  resolveReportDateRange,
} from './report-validation'
import { getCategoryBreakdown } from './profile-reports'
import type { CashFlowReport } from '../../shared/report-cash-flow'
import { getCashFlow } from './profile-report-cash-flow'
import { getSpendingPace } from './profile-report-pace'
import { getOverviewDashboard } from './profile-report-overview'
import type { OverviewDashboard } from '../../shared/report-overview'
import { getMonthlyTrend } from './profile-report-trend'

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
  getCashFlow(input: ReportDateRangeInput): CashFlowReport
  getSpendingPace(): SpendingPaceReport
  getOverviewDashboard(): OverviewDashboard
  getMonthlyTrend(input: ReportDateRangeInput): MonthlyTrendReport
  getCategoryBreakdown(input: ReportDateRangeInput): CategoryBreakdownReport
  convertToBaseCurrency(
    lines: readonly ConversionLine[],
  ): BaseCurrencyConversion
  getRateStatus(): RateStatus
  listTemplates(): TransactionTemplate[]
  listCategorisationRules(): CategorisationRule[]
  getCategorisationAutofill(
    input: CategorisationRuleDraftInput,
  ): CategorisationAutofill
  exportTransactionsCsv(input?: TransactionCsvInput): string
  listTransactions(input?: TransactionListInput): TransactionPage
  listPayees(): Payee[]
  listPayeeAliases(payeeId: string): PayeeAlias[]
  suggestPayees(input: PayeeSuggestionInput): PayeeSuggestion[]
  listTags(): Tag[]
  hasCategoryTransactions(id: string): boolean
  listCategories(): Category[]
  listCategoryOptions(kind: CategoryKind): Category[]
  listBackups(): ProfileBackup[]
  getProfileInfo(): ProfileInfo
  listAccounts(): Account[]
  listAccountOptions(input?: ListAccountOptionsInput): AccountOption[]
  getAccountBalance(id: string): number
  hasAccountTransactions(id: string): boolean
  getSettings(): ProfileSettings
}

export interface ProfileCommands {
  refreshExchangeRates(source: ExchangeRateSource): Promise<void>
  updateTemplate(input: UpdateTemplateInput): TransactionTemplate
  deleteTemplate(id: string): void
  saveTransactionAsTemplate(
    input: SaveTransactionAsTemplateInput,
  ): TransactionTemplate
  createTemplate(input: CreateTemplateInput): TransactionTemplate
  duplicateTransaction(id: string): string
  createCategorisationRule(
    input: CreateCategorisationRuleInput,
  ): CategorisationRule
  updateCategorisationRule(
    input: UpdateCategorisationRuleInput,
  ): CategorisationRule
  reorderCategorisationRule(input: ReorderCategorisationRuleInput): void
  deleteCategorisationRule(id: string): void
  createTransaction(input: CreateTransactionInput): Transaction
  updateTransaction(input: UpdateTransactionInput): Transaction
  deleteTransaction(id: string): void
  renameTag(input: RenameTagInput): Tag
  deleteTag(id: string): void
  createTransfer(input: CreateTransferInput): Transfer
  updateTransfer(input: UpdateTransferInput): Transfer
  deleteTransfer(id: string): void
  addPayeeAlias(input: AddPayeeAliasInput): PayeeAlias
  removePayeeAlias(id: string): void
  mergePayees(input: MergePayeesInput): Payee
  createBalanceAdjustment(
    input: CreateBalanceAdjustmentInput,
  ): BalanceAdjustment
  updateBalanceAdjustment(
    input: UpdateBalanceAdjustmentInput,
  ): BalanceAdjustment
  deleteBalanceAdjustment(id: string): void
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
  unarchiveAccount(id: string): void
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
  defineSqlMigration(
    9,
    'one-record transfers with linked fees',
    `
    CREATE TABLE transfers (
      id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
      from_account_id TEXT NOT NULL REFERENCES accounts(id),
      from_amount_minor INTEGER NOT NULL CHECK (
        typeof(from_amount_minor) = 'integer' AND
        from_amount_minor BETWEEN 1 AND 9007199254740991
      ),
      to_account_id TEXT NOT NULL REFERENCES accounts(id),
      to_amount_minor INTEGER NOT NULL CHECK (
        typeof(to_amount_minor) = 'integer' AND
        to_amount_minor BETWEEN 1 AND 9007199254740991
      ),
      date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      note TEXT NOT NULL CHECK (length(note) <= 1000),
      fee_transaction_id TEXT UNIQUE REFERENCES transactions(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (from_account_id <> to_account_id)
    );
    CREATE INDEX transfers_newest ON transfers(date DESC, created_at DESC, id DESC);
    CREATE INDEX transfers_from_account_newest
      ON transfers(from_account_id, date DESC, created_at DESC, id DESC);
    CREATE INDEX transfers_to_account_newest
      ON transfers(to_account_id, date DESC, created_at DESC, id DESC);
  `,
  ),
  defineSqlMigration(
    10,
    'tags on transaction lines',
    `
    CREATE TABLE tags (
      id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
      name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
      normalized_name TEXT NOT NULL UNIQUE CHECK (normalized_name = payee_key(name)),
      created_at TEXT NOT NULL
    );
    CREATE TABLE transaction_line_tags (
      line_id TEXT NOT NULL REFERENCES transaction_lines(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (line_id, tag_id)
    );
    CREATE INDEX transaction_line_tags_tag_id ON transaction_line_tags(tag_id, line_id);
  `,
  ),
  defineSqlMigration(
    11,
    'target-based balance adjustments',
    `
    CREATE TABLE balance_adjustments (
      id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
      account_id TEXT NOT NULL REFERENCES accounts(id),
      date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      observed_minor INTEGER NOT NULL CHECK (
        typeof(observed_minor) = 'integer' AND
        observed_minor BETWEEN -9007199254740991 AND 9007199254740991
      ),
      note TEXT NOT NULL CHECK (length(note) <= 1000),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX balance_adjustments_newest
      ON balance_adjustments(date DESC, created_at DESC, id DESC);
    CREATE INDEX balance_adjustments_account_history
      ON balance_adjustments(account_id, date, created_at, id);
  `,
  ),
  defineSqlMigration(
    12,
    'payee aliases',
    `
    CREATE TABLE payee_aliases (
      id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
      payee_id TEXT NOT NULL REFERENCES payees(id) ON DELETE CASCADE,
      name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
      normalized_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX payee_aliases_normalized_name
      ON payee_aliases(normalized_name);
    CREATE INDEX payee_aliases_payee_id ON payee_aliases(payee_id);
    CREATE TRIGGER payee_aliases_normalized_name_insert
    BEFORE INSERT ON payee_aliases
    WHEN NEW.normalized_name <> payee_alias_key(NEW.name)
      BEGIN SELECT RAISE(ABORT, 'Invalid normalized payee alias'); END;
    CREATE TRIGGER payee_aliases_normalized_name_update
    BEFORE UPDATE OF name, normalized_name ON payee_aliases
    WHEN NEW.normalized_name <> payee_alias_key(NEW.name)
      BEGIN SELECT RAISE(ABORT, 'Invalid normalized payee alias'); END;
  `,
  ),
  defineSqlMigration(
    13,
    'notes on transaction lines for splits',
    `
    ALTER TABLE transaction_lines
      ADD COLUMN note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 1000);
    UPDATE transaction_lines
    SET note = (
      SELECT transactions.note FROM transactions
      WHERE transactions.id = transaction_lines.transaction_id
    );
  `,
  ),
  defineSqlMigration(
    14,
    'transaction templates',
    `
    CREATE TABLE transaction_templates (
      id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
      name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
      kind TEXT CHECK (kind IN ('expense', 'income')),
      account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      total_minor INTEGER CHECK (
        total_minor IS NULL OR (typeof(total_minor) = 'integer' AND
        total_minor BETWEEN 1 AND 9007199254740991)
      ),
      payee_name TEXT CHECK (payee_name IS NULL OR length(trim(payee_name)) BETWEEN 1 AND 100),
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      tag_names TEXT NOT NULL CHECK (json_valid(tag_names) AND json_type(tag_names) = 'array'),
      note TEXT CHECK (note IS NULL OR length(note) <= 1000),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `,
  ),
  defineSqlMigration(
    15,
    'categorisation rules',
    `
    CREATE TABLE categorisation_rules (
      id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
      enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
      sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
      payee_id TEXT REFERENCES payees(id) ON DELETE RESTRICT,
      text_contains TEXT CHECK (
        text_contains IS NULL OR length(trim(text_contains)) BETWEEN 1 AND 1000
      ),
      account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
      min_amount_minor INTEGER CHECK (
        min_amount_minor IS NULL OR
        (typeof(min_amount_minor) = 'integer' AND min_amount_minor >= 0)
      ),
      max_amount_minor INTEGER CHECK (
        max_amount_minor IS NULL OR
        (typeof(max_amount_minor) = 'integer' AND max_amount_minor > 0)
      ),
      category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (payee_id IS NOT NULL OR text_contains IS NOT NULL),
      CHECK (
        min_amount_minor IS NULL OR max_amount_minor IS NULL OR
        min_amount_minor <= max_amount_minor
      )
    );
    CREATE INDEX categorisation_rules_priority
      ON categorisation_rules(sort_order);
    CREATE INDEX categorisation_rules_payee_id
      ON categorisation_rules(payee_id);
    CREATE INDEX categorisation_rules_account_id
      ON categorisation_rules(account_id);
    CREATE INDEX categorisation_rules_category_id
      ON categorisation_rules(category_id);
    CREATE TABLE categorisation_rule_tags (
      rule_id TEXT NOT NULL REFERENCES categorisation_rules(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (rule_id, tag_id)
    );
    CREATE INDEX categorisation_rule_tags_tag_id
      ON categorisation_rule_tags(tag_id, rule_id);
  `,
  ),
  defineSqlMigration(
    16,
    'currency-aware rules and tag-linked templates',
    `
    CREATE TEMP TABLE migrated_rule_tags AS
      SELECT rule_id, tag_id FROM categorisation_rule_tags;
    DROP TABLE categorisation_rule_tags;
    ALTER TABLE categorisation_rules RENAME TO old_categorisation_rules;
    CREATE TABLE categorisation_rules (
      id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
      enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
      sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
      payee_id TEXT REFERENCES payees(id) ON DELETE RESTRICT,
      text_contains TEXT CHECK (
        text_contains IS NULL OR length(trim(text_contains)) BETWEEN 1 AND 1000
      ),
      account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
      min_amount_minor INTEGER CHECK (
        min_amount_minor IS NULL OR
        (typeof(min_amount_minor) = 'integer' AND min_amount_minor >= 0)
      ),
      max_amount_minor INTEGER CHECK (
        max_amount_minor IS NULL OR
        (typeof(max_amount_minor) = 'integer' AND max_amount_minor > 0)
      ),
      amount_currency TEXT CHECK (amount_currency IN ('HUF', 'CHF')),
      action_payee_id TEXT REFERENCES payees(id) ON DELETE RESTRICT,
      category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (
        payee_id IS NOT NULL OR text_contains IS NOT NULL OR
        account_id IS NOT NULL OR min_amount_minor IS NOT NULL OR
        max_amount_minor IS NOT NULL
      ),
      CHECK (
        min_amount_minor IS NULL OR max_amount_minor IS NULL OR
        min_amount_minor <= max_amount_minor
      ),
      CHECK (
        (min_amount_minor IS NULL AND max_amount_minor IS NULL AND amount_currency IS NULL) OR
        ((min_amount_minor IS NOT NULL OR max_amount_minor IS NOT NULL) AND amount_currency IS NOT NULL)
      )
    );
    INSERT INTO categorisation_rules
      (id, enabled, sort_order, payee_id, text_contains, account_id,
       min_amount_minor, max_amount_minor, amount_currency, action_payee_id,
       category_id, created_at, updated_at)
    SELECT old.id, old.enabled, old.sort_order, old.payee_id,
      old.text_contains, old.account_id, old.min_amount_minor,
      old.max_amount_minor,
      CASE WHEN old.min_amount_minor IS NOT NULL OR old.max_amount_minor IS NOT NULL
        THEN COALESCE(accounts.currency, profile_settings.base_currency)
        ELSE NULL END,
      NULL, old.category_id, old.created_at, old.updated_at
    FROM old_categorisation_rules AS old
    LEFT JOIN accounts ON accounts.id = old.account_id
    CROSS JOIN profile_settings;
    DROP TABLE old_categorisation_rules;
    CREATE INDEX categorisation_rules_priority
      ON categorisation_rules(sort_order);
    CREATE INDEX categorisation_rules_payee_id
      ON categorisation_rules(payee_id);
    CREATE INDEX categorisation_rules_action_payee_id
      ON categorisation_rules(action_payee_id);
    CREATE INDEX categorisation_rules_account_id
      ON categorisation_rules(account_id);
    CREATE INDEX categorisation_rules_category_id
      ON categorisation_rules(category_id);
    CREATE TABLE categorisation_rule_tags (
      rule_id TEXT NOT NULL REFERENCES categorisation_rules(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (rule_id, tag_id)
    );
    INSERT INTO categorisation_rule_tags (rule_id, tag_id)
      SELECT rule_id, tag_id FROM migrated_rule_tags;
    DROP TABLE migrated_rule_tags;
    CREATE INDEX categorisation_rule_tags_tag_id
      ON categorisation_rule_tags(tag_id, rule_id);

    ALTER TABLE transaction_templates RENAME TO old_transaction_templates;
    CREATE TABLE transaction_templates (
      id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
      name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
      kind TEXT CHECK (kind IN ('expense', 'income')),
      account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      total_minor INTEGER CHECK (
        total_minor IS NULL OR (typeof(total_minor) = 'integer' AND
        total_minor BETWEEN 1 AND 9007199254740991)
      ),
      payee_name TEXT CHECK (payee_name IS NULL OR length(trim(payee_name)) BETWEEN 1 AND 100),
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      note TEXT CHECK (note IS NULL OR length(note) <= 1000),
      excluded INTEGER NOT NULL DEFAULT 0 CHECK (excluded IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    INSERT INTO transaction_templates
      (id, name, kind, account_id, total_minor, payee_name, category_id,
       note, excluded, created_at, updated_at)
    SELECT id, name, kind, account_id, total_minor, payee_name, category_id,
      note, 0, created_at, updated_at
    FROM old_transaction_templates;
    CREATE TABLE transaction_template_tags (
      template_id TEXT NOT NULL REFERENCES transaction_templates(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (template_id, tag_id)
    );
    INSERT OR IGNORE INTO transaction_template_tags (template_id, tag_id)
      SELECT templates.id, tags.id
      FROM old_transaction_templates AS templates,
        json_each(templates.tag_names) AS names
      JOIN tags ON tags.normalized_name = payee_key(names.value);
    DROP TABLE old_transaction_templates;
    CREATE INDEX transaction_template_tags_tag_id
      ON transaction_template_tags(tag_id, template_id);
  `,
  ),
  defineSqlMigration(
    17,
    'MNB exchange-rate cache',
    `
    CREATE TABLE exchange_rates (
      date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      currency TEXT NOT NULL CHECK (currency = 'CHF'),
      rate TEXT NOT NULL CHECK (length(rate) > 0),
      unit INTEGER NOT NULL CHECK (typeof(unit) = 'integer' AND unit > 0),
      PRIMARY KEY (date, currency)
    ) WITHOUT ROWID;
    CREATE TABLE exchange_rate_cache_metadata (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      coverage_start_date TEXT,
      coverage_end_date TEXT,
      last_refresh_at TEXT,
      CHECK (
        (coverage_start_date IS NULL AND coverage_end_date IS NULL) OR
        (coverage_start_date IS NOT NULL AND coverage_end_date IS NOT NULL AND
          coverage_start_date <= coverage_end_date)
      )
    );
    INSERT INTO exchange_rate_cache_metadata
      (id, coverage_start_date, coverage_end_date, last_refresh_at)
    VALUES (1, NULL, NULL, NULL);
  `,
  ),
  defineSqlMigration(
    18,
    'profile privacy mode',
    `
    ALTER TABLE profile_settings ADD COLUMN privacy_mode INTEGER NOT NULL
      DEFAULT 0 CHECK (privacy_mode IN (0, 1));
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
      refreshExchangeRates: (source) =>
        refreshProfileExchangeRates(
          this.#database,
          source,
          this.#clock,
          () => this.#assertAvailable(),
          (operation) => this.#executeBackgroundWrite(operation),
        ),
      updateTemplate: (input) =>
        this.#executeUndoableCommand(
          updateTemplateUndoableCommand(this.#database, input, this.#clock),
        ),
      deleteTemplate: (id) =>
        this.#executeUndoableCommand(
          deleteTemplateUndoableCommand(this.#database, id),
        ),
      saveTransactionAsTemplate: (input) =>
        this.#executeUndoableCommand(
          saveTransactionAsTemplateUndoableCommand(
            this.#database,
            input,
            this.#clock,
          ),
        ),
      createTemplate: (input) =>
        this.#executeUndoableCommand(
          createTemplateUndoableCommand(this.#database, input, this.#clock),
        ),
      duplicateTransaction: (id) =>
        this.#executeUndoableCommand(
          duplicateTransactionUndoableCommand(this.#database, id, this.#clock),
        ),
      createCategorisationRule: (input) =>
        this.#executeUndoableCommand(
          createCategorisationRuleUndoableCommand(
            this.#database,
            input,
            this.#clock,
          ),
        ),
      updateCategorisationRule: (input) =>
        this.#executeUndoableCommand(
          updateCategorisationRuleUndoableCommand(
            this.#database,
            input,
            this.#clock,
          ),
        ),
      reorderCategorisationRule: (input) =>
        this.#executeUndoableCommand(
          reorderCategorisationRuleUndoableCommand(this.#database, input),
        ),
      deleteCategorisationRule: (id) =>
        this.#executeUndoableCommand(
          deleteCategorisationRuleUndoableCommand(this.#database, id),
        ),
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
      deleteTag: (id) =>
        this.#executeUndoableCommand(
          deleteTagUndoableCommand(this.#database, id),
        ),
      renameTag: (input) =>
        this.#executeUndoableCommand(
          renameTagUndoableCommand(this.#database, input),
        ),
      createTransfer: (input) =>
        this.#executeUndoableCommand(
          createTransferUndoableCommand(this.#database, input, this.#clock),
        ),
      updateTransfer: (input) =>
        this.#executeUndoableCommand(
          updateTransferUndoableCommand(this.#database, input, this.#clock),
        ),
      deleteTransfer: (id) =>
        this.#executeUndoableCommand(
          deleteTransferUndoableCommand(this.#database, id),
        ),
      addPayeeAlias: (input) =>
        this.#executeUndoableCommand(
          addPayeeAliasUndoableCommand(this.#database, input, this.#clock),
        ),
      removePayeeAlias: (id) =>
        this.#executeUndoableCommand(
          removePayeeAliasUndoableCommand(this.#database, id),
        ),
      mergePayees: (input) =>
        this.#executeUndoableCommand(
          mergePayeesUndoableCommand(this.#database, input, this.#clock),
        ),
      createBalanceAdjustment: (input) =>
        this.#executeUndoableCommand(
          createBalanceAdjustmentUndoableCommand(
            this.#database,
            input,
            this.#clock,
          ),
        ),
      updateBalanceAdjustment: (input) =>
        this.#executeUndoableCommand(
          updateBalanceAdjustmentUndoableCommand(
            this.#database,
            input,
            this.#clock,
          ),
        ),
      deleteBalanceAdjustment: (id) =>
        this.#executeUndoableCommand(
          deleteBalanceAdjustmentUndoableCommand(this.#database, id),
        ),
      undoLast: () => {
        this.#assertAvailable()
        return this.#undoHistory.undoLast(this.#database)
      },
      deleteCategory: (input) =>
        this.#executeUndoableCommand(
          categoryUndoableCommand(
            this.#database,
            { kind: 'delete', id: input.id },
            () => deleteCategory(this.#database, input),
          ),
        ),
      reorderCategory: (input) =>
        this.#executeUndoableCommand(
          categoryUndoableCommand(
            this.#database,
            { kind: 'reorder', id: input.id },
            () => reorderCategory(this.#database, input),
          ),
        ),
      archiveCategory: (id) =>
        this.#executeUndoableCommand(
          categoryUndoableCommand(this.#database, { kind: 'edit', id }, () =>
            archiveCategory(this.#database, id),
          ),
        ),
      unarchiveCategory: (id) =>
        this.#executeUndoableCommand(
          categoryUndoableCommand(this.#database, { kind: 'edit', id }, () =>
            unarchiveCategory(this.#database, id),
          ),
        ),
      createCategory: (input) =>
        (() => {
          const id = this.#executeUndoableCommand(
            categoryUndoableCommand(this.#database, { kind: 'create' }, () =>
              createCategory(this.#database, input),
            ),
          )
          return this.queries
            .listCategories()
            .find((category) => category.id === id)!
        })(),
      renameCategory: (input) =>
        (() => {
          const id = this.#executeUndoableCommand(
            categoryUndoableCommand(
              this.#database,
              { kind: 'edit', id: input.id },
              () => renameCategory(this.#database, input),
            ),
          )
          return this.queries
            .listCategories()
            .find((category) => category.id === id)!
        })(),
      restoreBackup: (input) => this.#restoreBackup(input),
      ensureProfileIdentity: () => this.#ensureProfileIdentity(),
      createAccount: (input) =>
        this.#executeUndoableCommand(
          createAccountUndoableCommand(this.#database, input, this.#clock),
        ),
      renameAccount: (input) =>
        this.#executeUndoableCommand(
          renameAccountUndoableCommand(this.#database, input),
        ),
      changeAccountCurrency: (input) =>
        this.#executeUndoableCommand(
          changeAccountCurrencyUndoableCommand(this.#database, input),
        ),
      archiveAccount: (id) =>
        this.#executeUndoableCommand(
          archiveAccountUndoableCommand(this.#database, id),
        ),
      unarchiveAccount: (id) =>
        this.#executeUndoableCommand(
          unarchiveAccountUndoableCommand(this.#database, id),
        ),
      deleteAccount: (id) =>
        this.#executeUndoableCommand(
          deleteAccountUndoableCommand(this.#database, id),
        ),
      updateSettings: (changes) => this.#updateSettings(changes),
    }
    this.queries = {
      getCashFlow: (input) => {
        this.#assertAvailable()
        const range = resolveReportDateRange(
          parseReportDateRangeInput(input),
          this.#clock,
        )
        return this.#database.transaction(() =>
          getCashFlow(this.#database, range, this.#clock),
        )()
      },
      getSpendingPace: () => {
        this.#assertAvailable()
        return this.#database.transaction(() =>
          getSpendingPace(this.#database, this.#clock),
        )()
      },
      getOverviewDashboard: () => {
        this.#assertAvailable()
        return this.#database.transaction(() =>
          getOverviewDashboard(this.#database, this.#clock),
        )()
      },
      getMonthlyTrend: (input) => {
        this.#assertAvailable()
        const range = resolveReportDateRange(
          parseReportDateRangeInput(input),
          this.#clock,
        )
        return this.#database.transaction(() =>
          getMonthlyTrend(this.#database, range, this.#clock),
        )()
      },
      getCategoryBreakdown: (input) => {
        this.#assertAvailable()
        const range = resolveReportDateRange(
          parseReportDateRangeInput(input),
          this.#clock,
        )
        return this.#database.transaction(() =>
          getCategoryBreakdown(this.#database, range, this.#clock),
        )()
      },
      exportTransactionsCsv: (input) => {
        this.#assertAvailable()
        return this.#database.transaction(() =>
          exportTransactionsCsv(this.#database, input, this.#clock),
        )()
      },
      convertToBaseCurrency: (lines) => {
        this.#assertAvailable()
        return convertToBaseCurrency(this.#database, lines, this.#clock)
      },
      getRateStatus: () => {
        this.#assertAvailable()
        return getRateStatus(this.#database, this.#clock)
      },
      listTemplates: () => {
        this.#assertAvailable()
        return listTemplates(this.#database)
      },
      listCategorisationRules: () => {
        this.#assertAvailable()
        return listCategorisationRules(this.#database)
      },
      getCategorisationAutofill: (input) => {
        this.#assertAvailable()
        return getCategorisationAutofill(this.#database, input)
      },
      listTransactions: (input) => {
        this.#assertAvailable()
        const page = listTransactions(this.#database, input, this.#clock)
        const expense = convertToBaseCurrency(
          this.#database,
          page.days.flatMap((day) =>
            day.totals.map((total) => ({
              date: day.date,
              currency: total.currency,
              amountMinor: total.expenseMinor,
            })),
          ),
          this.#clock,
        )
        const income = convertToBaseCurrency(
          this.#database,
          page.days.flatMap((day) =>
            day.totals.map((total) => ({
              date: day.date,
              currency: total.currency,
              amountMinor: total.incomeMinor,
            })),
          ),
          this.#clock,
        )
        const unconverted = new Map<
          (typeof expense.unconverted)[number]['currency'],
          { expenseMinor: number; incomeMinor: number }
        >()
        for (const item of expense.unconverted)
          unconverted.set(item.currency, {
            expenseMinor: item.amountMinor,
            incomeMinor: 0,
          })
        for (const item of income.unconverted) {
          const current = unconverted.get(item.currency) ?? {
            expenseMinor: 0,
            incomeMinor: 0,
          }
          current.incomeMinor = item.amountMinor
          unconverted.set(item.currency, current)
        }
        return {
          ...page,
          baseTotals: {
            currency: expense.baseCurrency,
            expenseMinor: expense.roundedMinor,
            incomeMinor: income.roundedMinor,
            unconverted: [...unconverted.entries()]
              .map(([currency, totals]) => ({ currency, ...totals }))
              .sort((left, right) =>
                left.currency.localeCompare(right.currency),
              ),
            stale: expense.stale || income.stale,
          },
        }
      },
      listTags: () => {
        this.#assertAvailable()
        return listTags(this.#database)
      },
      listPayees: () => {
        this.#assertAvailable()
        return listPayees(this.#database)
      },
      listPayeeAliases: (payeeId) => {
        this.#assertAvailable()
        return listPayeeAliases(this.#database, payeeId)
      },
      suggestPayees: (input) => {
        this.#assertAvailable()
        return suggestPayees(this.#database, input)
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
      listAccountOptions: (input) => {
        this.#assertAvailable()
        return listAccountOptions(this.#database, input)
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

  #executeBackgroundWrite(operation: () => void): void {
    this.#assertAvailable()
    // Cache maintenance is not a user-data command. It must neither be
    // undoable nor invalidate user-data images already in the undo history.
    this.#database.transaction(operation)()
  }

  #executeUndoableCommand<BeforeImage, AfterImage, Result>(
    command: UndoableCommand<BeforeImage, AfterImage, Result>,
  ): Result {
    this.#assertAvailable()
    return this.#undoHistory.execute(this.#database, command)
  }

  #updateSettings(changes: ProfileSettingsChanges): ProfileSettings {
    this.#assertAvailable()
    const parsed = parseSettingsChanges(changes)
    const update = () => {
      const settings = { ...this.#getSettings(), ...parsed }
      this.#database
        .prepare(
          'UPDATE profile_settings SET language = ?, theme = ?, base_currency = ?, privacy_mode = ? WHERE id = 1',
        )
        .run(
          settings.language,
          settings.theme,
          settings.baseCurrency,
          Number(settings.privacyMode),
        )
      return this.#getSettings()
    }
    // Privacy is presentation-only: do not invalidate ledger undo images.
    // Mixed writes retain the existing non-undoable settings-command boundary.
    if (Object.keys(parsed).every((key) => key === 'privacyMode')) {
      return this.#database.transaction(update)()
    }
    return this.#executeCommand(update)
  }

  #getSettings(): ProfileSettings {
    this.#assertAvailable()
    const row = this.#database
      .prepare('SELECT * FROM profile_settings WHERE id = 1')
      .get() as {
      language: ProfileSettings['language']
      theme: ProfileSettings['theme']
      base_currency: ProfileSettings['baseCurrency']
      privacy_mode?: number
    }
    return {
      language: row.language,
      theme: row.theme,
      baseCurrency: row.base_currency,
      privacyMode: row.privacy_mode === 1,
    }
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
