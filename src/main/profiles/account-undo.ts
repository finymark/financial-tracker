import type Database from 'better-sqlite3'
import type {
  ChangeAccountCurrencyInput,
  CreateAccountInput,
  RenameAccountInput,
} from '../../shared/accounts'
import {
  archiveAccount,
  changeAccountCurrency,
  createAccount,
  deleteAccount,
  renameAccount,
  unarchiveAccount,
} from './profile-accounts'
import {
  captureCategorisationRules,
  restoreCategorisationRules,
  type CategorisationRulesImage,
} from './rule-undo'
import type { UndoableCommand } from './undo-history'

interface StoredAccountImage {
  id: string
  name: string
  currency: 'HUF' | 'CHF'
  openingBalance: number
  openingDate: string
  createdAt: string
  archived: number
}

interface AccountAggregateImage {
  account: StoredAccountImage | null
  templateIds: string[]
  rules: CategorisationRulesImage | null
}

function captureAccount(
  database: Database.Database,
  id: string | null,
): AccountAggregateImage {
  const account = id
    ? ((database
        .prepare(
          `SELECT id, name, currency, opening_balance AS openingBalance,
            opening_date AS openingDate, created_at AS createdAt, archived
           FROM accounts WHERE id = ?`,
        )
        .get(id) as StoredAccountImage | undefined) ?? null)
    : null
  const templateIds = id
    ? (
        database
          .prepare(
            `SELECT id FROM transaction_templates WHERE account_id = ?
             ORDER BY id`,
          )
          .all(id) as { id: string }[]
      ).map((row) => row.id)
    : []
  return {
    account,
    templateIds,
    rules: captureCategorisationRules(database),
  }
}

function restoreAccount(
  database: Database.Database,
  before: AccountAggregateImage,
  after: AccountAggregateImage,
): void {
  const id = before.account?.id ?? after.account?.id
  if (!id) return
  if (before.account === null) {
    database.prepare('DELETE FROM accounts WHERE id = ?').run(id)
    restoreCategorisationRules(database, before.rules)
    return
  }
  const account = before.account
  database
    .prepare(
      `INSERT INTO accounts
        (id, name, currency, opening_balance, opening_date, created_at, archived)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name,
         currency = excluded.currency, opening_balance = excluded.opening_balance,
         opening_date = excluded.opening_date, created_at = excluded.created_at,
         archived = excluded.archived`,
    )
    .run(
      account.id,
      account.name,
      account.currency,
      account.openingBalance,
      account.openingDate,
      account.createdAt,
      account.archived,
    )
  const restoreTemplate = database.prepare(
    'UPDATE transaction_templates SET account_id = ? WHERE id = ?',
  )
  for (const templateId of before.templateIds)
    restoreTemplate.run(account.id, templateId)
  restoreCategorisationRules(database, before.rules)
}

function accountCommand<Result>(
  database: Database.Database,
  idBefore: string | null,
  execute: () => Result,
  idAfter: (result: Result) => string | null,
): UndoableCommand<AccountAggregateImage, AccountAggregateImage, Result> {
  return {
    captureBefore: () => captureAccount(database, idBefore),
    execute,
    captureAfter: (result) => captureAccount(database, idAfter(result)),
    restoreBefore: (before, after) => restoreAccount(database, before, after),
  }
}

export function createAccountUndoableCommand(
  database: Database.Database,
  input: CreateAccountInput,
  clock: () => Date,
) {
  return accountCommand(
    database,
    null,
    () => createAccount(database, input, clock),
    (account) => account.id,
  )
}

export function renameAccountUndoableCommand(
  database: Database.Database,
  input: RenameAccountInput,
) {
  return accountCommand(
    database,
    input.id,
    () => renameAccount(database, input),
    (account) => account.id,
  )
}

export function changeAccountCurrencyUndoableCommand(
  database: Database.Database,
  input: ChangeAccountCurrencyInput,
) {
  return accountCommand(
    database,
    input.id,
    () => changeAccountCurrency(database, input),
    (account) => account.id,
  )
}

function voidAccountCommand(
  database: Database.Database,
  id: string,
  execute: () => void,
) {
  return accountCommand(database, id, execute, () => id)
}

export const archiveAccountUndoableCommand = (
  database: Database.Database,
  id: string,
) => voidAccountCommand(database, id, () => archiveAccount(database, id))

export const unarchiveAccountUndoableCommand = (
  database: Database.Database,
  id: string,
) => voidAccountCommand(database, id, () => unarchiveAccount(database, id))

export const deleteAccountUndoableCommand = (
  database: Database.Database,
  id: string,
) => voidAccountCommand(database, id, () => deleteAccount(database, id))
