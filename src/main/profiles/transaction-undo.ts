import type Database from 'better-sqlite3'
import type {
  CreateTransactionInput,
  Transaction,
  UpdateTransactionInput,
} from '../../shared/transactions'
import { normalizePayeeKey } from '../db'
import type { Tag } from '../../shared/tags'
import { hasTagSchema, getLineTags } from './profile-tags'
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
  note?: string
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
  tags: Tag[]
  lineTags: { lineId: string; tagId: string }[]
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

function existingInputTagIds(
  database: Database.Database,
  names: unknown,
): string[] {
  if (!hasTagSchema(database) || !Array.isArray(names)) return []
  return names.flatMap((name) => {
    if (typeof name !== 'string') return []
    const tag = database
      .prepare('SELECT id FROM tags WHERE normalized_name = ?')
      .get(normalizePayeeKey(name.trim())) as { id: string } | undefined
    return tag ? [tag.id] : []
  })
}

function inputTagNames(input: CreateTransactionInput): unknown[] {
  return [
    ...(Array.isArray(input.tagNames) ? input.tagNames : []),
    ...(Array.isArray(input.lines)
      ? input.lines.flatMap((line) =>
          Array.isArray(line?.tagNames) ? line.tagNames : [],
        )
      : []),
  ]
}

function hasLineNotes(database: Database.Database): boolean {
  return (
    database.pragma('table_info(transaction_lines)') as { name: string }[]
  ).some((column) => column.name === 'note')
}

function captureAggregate(
  database: Database.Database,
  transactionId: string | null,
  additionalPayeeIds: readonly (string | null)[] = [],
  additionalTagIds: readonly string[] = [],
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
  const lineNotes = hasLineNotes(database)
  const lines = transaction
    ? (database
        .prepare(
          `SELECT id, transaction_id AS transactionId,
            amount_minor AS amountMinor, category_id AS categoryId
            ${lineNotes ? ', note' : ''}
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
  const lineTags = lines.flatMap((line) =>
    getLineTags(database, line.id).map((tag) => ({
      lineId: line.id,
      tagId: tag.id,
    })),
  )
  const tagIds = [
    ...new Set([
      ...lineTags.map((association) => association.tagId),
      ...additionalTagIds,
    ]),
  ]
  const tags = tagIds.map(
    (id) =>
      database
        .prepare(
          'SELECT id, name, created_at AS createdAt FROM tags WHERE id = ?',
        )
        .get(id) as Tag,
  )
  return { transaction, lines, payees, tags, lineTags }
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
  for (const tag of before.tags) {
    database
      .prepare(
        `INSERT INTO tags (id, name, normalized_name, created_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, normalized_name = excluded.normalized_name, created_at = excluded.created_at`,
      )
      .run(tag.id, tag.name, normalizePayeeKey(tag.name), tag.createdAt)
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
    const lineNotes = hasLineNotes(database)
    const insertLine = database.prepare(
      lineNotes
        ? `INSERT INTO transaction_lines
        (id, transaction_id, amount_minor, category_id, note) VALUES (?, ?, ?, ?, ?)`
        : `INSERT INTO transaction_lines
        (id, transaction_id, amount_minor, category_id) VALUES (?, ?, ?, ?)`,
    )
    for (const line of before.lines) {
      if (lineNotes)
        insertLine.run(
          line.id,
          line.transactionId,
          line.amountMinor,
          line.categoryId,
          line.note,
        )
      else
        insertLine.run(
          line.id,
          line.transactionId,
          line.amountMinor,
          line.categoryId,
        )
    }
  }
  for (const association of before.lineTags) {
    database
      .prepare(
        'INSERT INTO transaction_line_tags (line_id, tag_id) VALUES (?, ?)',
      )
      .run(association.lineId, association.tagId)
  }
  const beforeTagIds = new Set(before.tags.map((tag) => tag.id))
  for (const tag of after.tags) {
    if (!beforeTagIds.has(tag.id)) {
      database
        .prepare(
          `DELETE FROM tags WHERE id = ? AND NOT EXISTS (SELECT 1 FROM transaction_line_tags WHERE tag_id = ?)`,
        )
        .run(tag.id, tag.id)
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
      captureAggregate(
        database,
        null,
        [findExistingPayeeId(database, input.payeeName)],
        existingInputTagIds(database, inputTagNames(input)),
      ),
    execute: () => createTransaction(database, input, clock),
    captureAfter: (result, before) =>
      captureAggregate(
        database,
        result.id,
        affectedPayeeIds(before),
        before.tags.map((tag) => tag.id),
      ),
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
      return captureAggregate(
        database,
        input.id,
        [
          ...affectedPayeeIds(current),
          findExistingPayeeId(database, input.payeeName),
        ],
        [
          ...current.tags.map((tag) => tag.id),
          ...existingInputTagIds(database, inputTagNames(input)),
        ],
      )
    },
    execute: () => updateTransaction(database, input, clock),
    captureAfter: (result, before) =>
      captureAggregate(
        database,
        result.id,
        affectedPayeeIds(before),
        before.tags.map((tag) => tag.id),
      ),
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
      captureAggregate(
        database,
        null,
        affectedPayeeIds(before),
        before.tags.map((tag) => tag.id),
      ),
    restoreBefore: (before, after) => restoreAggregate(database, before, after),
  }
}
