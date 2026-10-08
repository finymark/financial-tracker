import type Database from 'better-sqlite3'
import type {
  CreateTransactionInput,
  Transaction,
  UpdateTransactionInput,
} from '../../shared/transactions'
import { normalizePayeeAliasKey, normalizePayeeKey } from '../db'
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from './profile-transactions'
import type { UndoableCommand } from './undo-history'

interface StoredTransactionImage {
  id: string
  accountId: string
  kind: 'expense' | 'income'
  date: string
  totalMinor: number
  payeeId: string | null
  note: string
  // Absent in pre-exclusion migration fixtures.
  excluded?: number
  createdAt: string
  updatedAt: string
}

interface StoredTransactionLineImage {
  id: string
  transactionId: string
  amountMinor: number
  categoryId: string | null
}

interface StoredPayeeImage {
  id: string
  name: string
  normalizedName?: string
  createdAt: string
}

interface TransactionAggregateImage {
  transaction: StoredTransactionImage | null
  lines: StoredTransactionLineImage[]
  payees: StoredPayeeImage[]
}

function hasNormalizedPayeeNames(database: Database.Database): boolean {
  return (database.pragma('table_info(payees)') as { name: string }[]).some(
    (column) => column.name === 'normalized_name',
  )
}

function findExistingPayeeId(
  database: Database.Database,
  value: unknown,
): string | null {
  if (typeof value !== 'string') return null
  const name = value.trim()
  if (name.length === 0 || name.length > 100) return null
  const aliasesAvailable = Boolean(
    database
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'payee_aliases'",
      )
      .get(),
  )
  if (aliasesAvailable) {
    const alias = database
      .prepare(
        'SELECT payee_id AS id FROM payee_aliases WHERE normalized_name = ?',
      )
      .get(normalizePayeeAliasKey(name)) as { id: string } | undefined
    if (alias) return alias.id
  }
  const row = (
    hasNormalizedPayeeNames(database)
      ? database
          .prepare('SELECT id FROM payees WHERE normalized_name = ?')
          .get(normalizePayeeKey(name))
      : database
          .prepare('SELECT id FROM payees WHERE name = ? COLLATE NOCASE')
          .get(name)
  ) as { id: string } | undefined
  return row?.id ?? null
}

function captureAggregate(
  database: Database.Database,
  transactionId: string | null,
  additionalPayeeIds: readonly (string | null)[] = [],
): TransactionAggregateImage {
  const transaction = transactionId
    ? ((database
        .prepare(
          `SELECT *, account_id AS accountId,
            total_minor AS totalMinor, payee_id AS payeeId,
            created_at AS createdAt, updated_at AS updatedAt
          FROM transactions WHERE id = ?`,
        )
        .get(transactionId) as StoredTransactionImage | undefined) ?? null)
    : null
  const lines = transaction
    ? (database
        .prepare(
          `SELECT id, transaction_id AS transactionId,
            amount_minor AS amountMinor, category_id AS categoryId
          FROM transaction_lines WHERE transaction_id = ? ORDER BY rowid`,
        )
        .all(transaction.id) as StoredTransactionLineImage[])
    : []
  const payeeIds = [transaction?.payeeId, ...additionalPayeeIds].filter(
    (id): id is string => id !== null && id !== undefined,
  )
  const uniquePayeeIds = [...new Set(payeeIds)]
  const normalized = hasNormalizedPayeeNames(database)
  const payees = uniquePayeeIds.map((id) => {
    const payee = database
      .prepare(
        normalized
          ? `SELECT id, name, normalized_name AS normalizedName,
              created_at AS createdAt FROM payees WHERE id = ?`
          : 'SELECT id, name, created_at AS createdAt FROM payees WHERE id = ?',
      )
      .get(id) as StoredPayeeImage | undefined
    if (!payee) throw new Error('transactions.error.notFound')
    return payee
  })
  return { transaction, lines, payees }
}

function restoreAggregate(
  database: Database.Database,
  before: TransactionAggregateImage,
  after: TransactionAggregateImage,
): void {
  const transactionId = before.transaction?.id ?? after.transaction?.id
  if (transactionId) {
    database.prepare('DELETE FROM transactions WHERE id = ?').run(transactionId)
  }
  const normalized = hasNormalizedPayeeNames(database)
  for (const payee of before.payees) {
    if (normalized) {
      database
        .prepare(
          `INSERT INTO payees (id, name, normalized_name, created_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name = excluded.name,
            normalized_name = excluded.normalized_name,
            created_at = excluded.created_at`,
        )
        .run(payee.id, payee.name, payee.normalizedName, payee.createdAt)
    } else {
      database
        .prepare(
          `INSERT INTO payees (id, name, created_at) VALUES (?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name = excluded.name,
            created_at = excluded.created_at`,
        )
        .run(payee.id, payee.name, payee.createdAt)
    }
  }
  if (before.transaction) {
    const transaction = before.transaction
    database
      .prepare(
        `INSERT INTO transactions
          (id, account_id, kind, date, total_minor, payee_id, note, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        transaction.id,
        transaction.accountId,
        transaction.kind,
        transaction.date,
        transaction.totalMinor,
        transaction.payeeId,
        transaction.note,
        transaction.createdAt,
        transaction.updatedAt,
      )
    if (transaction.excluded !== undefined) {
      database
        .prepare('UPDATE transactions SET excluded = ? WHERE id = ?')
        .run(transaction.excluded, transaction.id)
    }
    const insertLine = database.prepare(
      `INSERT INTO transaction_lines
        (id, transaction_id, amount_minor, category_id) VALUES (?, ?, ?, ?)`,
    )
    for (const line of before.lines) {
      insertLine.run(
        line.id,
        line.transactionId,
        line.amountMinor,
        line.categoryId,
      )
    }
  }
  const beforePayeeIds = new Set(before.payees.map((payee) => payee.id))
  for (const payee of after.payees) {
    if (!beforePayeeIds.has(payee.id)) {
      database
        .prepare(
          `DELETE FROM payees WHERE id = ?
          AND NOT EXISTS (SELECT 1 FROM transactions WHERE payee_id = ?)`,
        )
        .run(payee.id, payee.id)
    }
  }
}

function affectedPayeeIds(image: TransactionAggregateImage): string[] {
  return image.payees.map((payee) => payee.id)
}

export function createTransactionUndoableCommand(
  database: Database.Database,
  input: CreateTransactionInput,
  clock: () => Date,
): UndoableCommand<
  TransactionAggregateImage,
  TransactionAggregateImage,
  Transaction
> {
  return {
    captureBefore: () =>
      captureAggregate(database, null, [
        findExistingPayeeId(database, input.payeeName),
      ]),
    execute: () => createTransaction(database, input, clock),
    captureAfter: (result, before) =>
      captureAggregate(database, result.id, affectedPayeeIds(before)),
    restoreBefore: (before, after) => restoreAggregate(database, before, after),
  }
}

export function updateTransactionUndoableCommand(
  database: Database.Database,
  input: UpdateTransactionInput,
  clock: () => Date,
): UndoableCommand<
  TransactionAggregateImage,
  TransactionAggregateImage,
  Transaction
> {
  return {
    captureBefore: () => {
      const current = captureAggregate(database, input.id)
      return captureAggregate(database, input.id, [
        ...affectedPayeeIds(current),
        findExistingPayeeId(database, input.payeeName),
      ])
    },
    execute: () => updateTransaction(database, input, clock),
    captureAfter: (result, before) =>
      captureAggregate(database, result.id, affectedPayeeIds(before)),
    restoreBefore: (before, after) => restoreAggregate(database, before, after),
  }
}

export function deleteTransactionUndoableCommand(
  database: Database.Database,
  id: string,
): UndoableCommand<TransactionAggregateImage, TransactionAggregateImage, void> {
  return {
    captureBefore: () => captureAggregate(database, id),
    execute: () => deleteTransaction(database, id),
    captureAfter: (_result, before) =>
      captureAggregate(database, null, affectedPayeeIds(before)),
    restoreBefore: (before, after) => restoreAggregate(database, before, after),
  }
}
