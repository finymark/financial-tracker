import type Database from 'better-sqlite3'
import type {
  CreateTransactionInput,
  Transaction,
  UpdateTransactionInput,
} from '../../shared/transactions'
import { payeeAliasKey, payeeKey, tagKey } from '../../shared/text-keys'
import type { Tag } from '../../shared/tags'
import { getLineTags } from './profile-tags'
import {
  createTransaction,
  duplicateTransaction,
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
  excluded: number
  createdAt: string
  updatedAt: string
}

interface StoredTransactionLineImage {
  id: string
  transactionId: string
  amountMinor: number
  categoryId: string | null
  note: string
}

interface StoredPayeeImage {
  id: string
  name: string
  normalizedName: string
  createdAt: string
}

export interface TransactionAggregateImage {
  transaction: StoredTransactionImage | null
  lines: StoredTransactionLineImage[]
  payees: StoredPayeeImage[]
  tags: Tag[]
  lineTags: { lineId: string; tagId: string }[]
}

function findExistingPayeeId(
  database: Database.Database,
  value: unknown,
): string | null {
  if (typeof value !== 'string') return null
  const name = value.trim()
  if (name.length === 0 || name.length > 100) return null
  const alias = database
    .prepare(
      'SELECT payee_id AS id FROM payee_aliases WHERE normalized_name = ?',
    )
    .get(payeeAliasKey(name)) as { id: string } | undefined
  if (alias) return alias.id
  const row = database
    .prepare('SELECT id FROM payees WHERE normalized_name = ?')
    .get(payeeKey(name)) as { id: string } | undefined
  return row?.id ?? null
}

function existingInputTagIds(
  database: Database.Database,
  names: unknown,
): string[] {
  if (!Array.isArray(names)) return []
  return names.flatMap((name) => {
    if (typeof name !== 'string') return []
    const tag = database
      .prepare('SELECT id FROM tags WHERE normalized_name = ?')
      .get(tagKey(name.trim())) as { id: string } | undefined
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

export function captureTransactionAggregate(
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
  const lines = transaction
    ? (database
        .prepare(
          `SELECT id, transaction_id AS transactionId,
            amount_minor AS amountMinor, category_id AS categoryId, note
          FROM transaction_lines WHERE transaction_id = ? ORDER BY rowid`,
        )
        .all(transaction.id) as StoredTransactionLineImage[])
    : []
  const payeeIds = [transaction?.payeeId, ...additionalPayeeIds].filter(
    (id): id is string => id !== null && id !== undefined,
  )
  const uniquePayeeIds = [...new Set(payeeIds)]
  const payees = uniquePayeeIds.map((id) => {
    const payee = database
      .prepare(
        `SELECT id, name, normalized_name AS normalizedName,
          created_at AS createdAt FROM payees WHERE id = ?`,
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

export function restoreTransactionAggregate(
  database: Database.Database,
  before: TransactionAggregateImage,
  after: TransactionAggregateImage,
): void {
  const transactionId = before.transaction?.id ?? after.transaction?.id
  if (transactionId) {
    database.prepare('DELETE FROM transactions WHERE id = ?').run(transactionId)
  }
  for (const payee of before.payees) {
    database
      .prepare(
        `INSERT INTO payees (id, name, normalized_name, created_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name,
          normalized_name = excluded.normalized_name,
          created_at = excluded.created_at`,
      )
      .run(payee.id, payee.name, payee.normalizedName, payee.createdAt)
  }
  for (const tag of before.tags) {
    database
      .prepare(
        `INSERT INTO tags (id, name, normalized_name, created_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, normalized_name = excluded.normalized_name, created_at = excluded.created_at`,
      )
      .run(tag.id, tag.name, tagKey(tag.name), tag.createdAt)
  }
  if (before.transaction) {
    const transaction = before.transaction
    database
      .prepare(
        `INSERT INTO transactions
          (id, account_id, kind, date, total_minor, payee_id, note, excluded,
           created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        transaction.id,
        transaction.accountId,
        transaction.kind,
        transaction.date,
        transaction.totalMinor,
        transaction.payeeId,
        transaction.note,
        transaction.excluded,
        transaction.createdAt,
        transaction.updatedAt,
      )
    const insertLine = database.prepare(
      `INSERT INTO transaction_lines
        (id, transaction_id, amount_minor, category_id, note)
       VALUES (?, ?, ?, ?, ?)`,
    )
    for (const line of before.lines) {
      insertLine.run(
        line.id,
        line.transactionId,
        line.amountMinor,
        line.categoryId,
        line.note,
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
      captureTransactionAggregate(
        database,
        null,
        [findExistingPayeeId(database, input.payeeName)],
        existingInputTagIds(database, inputTagNames(input)),
      ),
    execute: () => createTransaction(database, input, clock),
    captureAfter: (result, before) =>
      captureTransactionAggregate(
        database,
        result.id,
        affectedPayeeIds(before),
        before.tags.map((tag) => tag.id),
      ),
    restoreBefore: (before, after) =>
      restoreTransactionAggregate(database, before, after),
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
      const current = captureTransactionAggregate(database, input.id)
      return captureTransactionAggregate(
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
      captureTransactionAggregate(
        database,
        result.id,
        affectedPayeeIds(before),
        before.tags.map((tag) => tag.id),
      ),
    restoreBefore: (before, after) =>
      restoreTransactionAggregate(database, before, after),
  }
}

export function deleteTransactionUndoableCommand(
  database: Database.Database,
  id: string,
): UndoableCommand<TransactionAggregateImage, TransactionAggregateImage, void> {
  return {
    captureBefore: () => captureTransactionAggregate(database, id),
    execute: () => deleteTransaction(database, id),
    captureAfter: (_result, before) =>
      captureTransactionAggregate(
        database,
        null,
        affectedPayeeIds(before),
        before.tags.map((tag) => tag.id),
      ),
    restoreBefore: (before, after) =>
      restoreTransactionAggregate(database, before, after),
  }
}

export function duplicateTransactionUndoableCommand(
  database: Database.Database,
  id: string,
  clock: () => Date,
): UndoableCommand<
  TransactionAggregateImage,
  TransactionAggregateImage,
  string
> {
  return {
    captureBefore: () => {
      const source = captureTransactionAggregate(database, id)
      if (!source.transaction) throw new Error('transactions.error.notFound')
      return { ...source, transaction: null, lines: [], lineTags: [] }
    },
    execute: () => duplicateTransaction(database, id, clock),
    captureAfter: (result, before) =>
      captureTransactionAggregate(
        database,
        result,
        affectedPayeeIds(before),
        before.tags.map((tag) => tag.id),
      ),
    restoreBefore: (before, after) =>
      restoreTransactionAggregate(database, before, after),
  }
}
