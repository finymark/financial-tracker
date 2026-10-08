import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type {
  Account,
  ChangeAccountCurrencyInput,
  CreateAccountInput,
  RenameAccountInput,
} from '../../shared/accounts'
import {
  validateAccountCurrency,
  validateAccountId,
  validateAccountName,
  validateOpeningBalance,
  validateOpeningDate,
} from './account-validation'

interface StoredAccount extends CreateAccountInput {
  id: string
  createdAt: string
  archived: number
}

const ACCOUNT_COLUMNS = `id, name, currency, opening_balance AS openingBalance,
  opening_date AS openingDate, created_at AS createdAt, archived`

function getAccount(database: Database.Database, id: string): StoredAccount {
  const account = database
    .prepare(`SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE id = ?`)
    .get(validateAccountId(id)) as StoredAccount | undefined
  if (!account) throw new Error('accounts.error.notFound')
  return account
}

function hasTransfersTable(database: Database.Database): boolean {
  return Boolean(
    database
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'transfers'",
      )
      .get(),
  )
}

export function hasAccountTransactions(
  database: Database.Database,
  id: string,
): boolean {
  const account = getAccount(database, id)
  const transaction = Boolean(
    database
      .prepare('SELECT 1 FROM transactions WHERE account_id = ? LIMIT 1')
      .get(account.id),
  )
  if (transaction || !hasTransfersTable(database)) return transaction
  return Boolean(
    database
      .prepare(
        `SELECT 1 FROM transfers
         WHERE from_account_id = ? OR to_account_id = ? LIMIT 1`,
      )
      .get(account.id, account.id),
  )
}

export function getAccountBalance(
  database: Database.Database,
  id: string,
): number {
  const account = getAccount(database, id)
  const totals = database
    .prepare(
      `SELECT COALESCE(SUM(
        CASE kind WHEN 'income' THEN total_minor ELSE -total_minor END
      ), 0) AS total FROM transactions WHERE account_id = ?`,
    )
    .get(account.id) as { total: number }
  const transferTotals = hasTransfersTable(database)
    ? (database
        .prepare(
          `SELECT COALESCE(SUM(
            CASE
              WHEN from_account_id = ? THEN -from_amount_minor
              ELSE to_amount_minor
            END
          ), 0) AS total
          FROM transfers
          WHERE from_account_id = ? OR to_account_id = ?`,
        )
        .get(account.id, account.id, account.id) as { total: number })
    : { total: 0 }
  const balance = account.openingBalance + totals.total + transferTotals.total
  if (!Number.isSafeInteger(balance)) throw new Error('accounts.error.balance')
  return balance
}

function accountView(
  database: Database.Database,
  account: StoredAccount,
): Account {
  return {
    ...account,
    archived: Boolean(account.archived),
    balance: getAccountBalance(database, account.id),
    hasTransactions: hasAccountTransactions(database, account.id),
  }
}

export function listAccounts(
  database: Database.Database,
  activeOnly = false,
): Account[] {
  const accounts = database
    .prepare(
      `SELECT ${ACCOUNT_COLUMNS} FROM accounts ${activeOnly ? 'WHERE archived = 0' : ''} ORDER BY created_at, rowid`,
    )
    .all() as StoredAccount[]
  return accounts.map((account) => accountView(database, account))
}

export function createAccount(
  database: Database.Database,
  input: CreateAccountInput,
  clock: () => Date,
): Account {
  const id = randomUUID()
  database
    .prepare(
      `INSERT INTO accounts
      (id, name, currency, opening_balance, opening_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      validateAccountName(input.name),
      validateAccountCurrency(input.currency),
      validateOpeningBalance(input.openingBalance),
      validateOpeningDate(input.openingDate),
      clock().toISOString(),
    )
  return accountView(database, getAccount(database, id))
}

export function renameAccount(
  database: Database.Database,
  input: RenameAccountInput,
): Account {
  const account = getAccount(database, input.id)
  database
    .prepare('UPDATE accounts SET name = ? WHERE id = ?')
    .run(validateAccountName(input.name), account.id)
  return accountView(database, getAccount(database, account.id))
}

export function changeAccountCurrency(
  database: Database.Database,
  input: ChangeAccountCurrencyInput,
): Account {
  const account = getAccount(database, input.id)
  const currency = validateAccountCurrency(input.currency)
  if (
    currency !== account.currency &&
    hasAccountTransactions(database, account.id)
  ) {
    throw new Error('accounts.error.currencyLocked')
  }
  database
    .prepare('UPDATE accounts SET currency = ? WHERE id = ?')
    .run(currency, account.id)
  return accountView(database, getAccount(database, account.id))
}

export function archiveAccount(database: Database.Database, id: string): void {
  const account = getAccount(database, id)
  database
    .prepare('UPDATE accounts SET archived = 1 WHERE id = ?')
    .run(account.id)
}

export function deleteAccount(database: Database.Database, id: string): void {
  const account = getAccount(database, id)
  if (hasAccountTransactions(database, account.id)) {
    throw new Error('accounts.error.notEmpty')
  }
  database.prepare('DELETE FROM accounts WHERE id = ?').run(account.id)
}
