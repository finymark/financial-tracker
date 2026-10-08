import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type {
  CreateTransactionInput,
  Payee,
  Transaction,
  UpdateTransactionInput,
} from '../../shared/transactions'
import { getCategory } from './profile-categories'
import {
  validateTransactionAccountId,
  validateTransactionCategoryId,
  validateTransactionDate,
  validateTransactionKind,
  validateTransactionNote,
  validateTransactionPayeeName,
  validateTransactionTotal,
  validateTransactionId,
} from './transaction-validation'

interface StoredTransaction {
  id: string
  accountId: string
  kind: 'expense' | 'income'
  date: string
  totalMinor: number
  payeeId: string | null
  payeeName: string | null
  note: string
  createdAt: string
  updatedAt: string
  lineId: string
  amountMinor: number
  categoryId: string | null
  lineCount: number
  lineTotal: number
}

const TRANSACTION_SELECT = `
  SELECT transactions.id,
    transactions.account_id AS accountId,
    transactions.kind,
    transactions.date,
    transactions.total_minor AS totalMinor,
    transactions.payee_id AS payeeId,
    payees.name AS payeeName,
    transactions.note,
    transactions.created_at AS createdAt,
    transactions.updated_at AS updatedAt,
    transaction_lines.id AS lineId,
    transaction_lines.amount_minor AS amountMinor,
    transaction_lines.category_id AS categoryId,
    COUNT(transaction_lines.id) OVER (PARTITION BY transactions.id) AS lineCount,
    SUM(transaction_lines.amount_minor) OVER (PARTITION BY transactions.id) AS lineTotal
  FROM transactions
  LEFT JOIN payees ON payees.id = transactions.payee_id
  LEFT JOIN transaction_lines ON transaction_lines.transaction_id = transactions.id`

function transactionView(row: StoredTransaction | undefined): Transaction {
  if (!row) throw new Error('transactions.error.notFound')
  if (row.lineCount !== 1 || row.lineTotal !== row.totalMinor || !row.lineId) {
    throw new Error('transactions.error.lines')
  }
  return {
    id: row.id,
    accountId: row.accountId,
    kind: row.kind,
    date: row.date,
    totalMinor: row.totalMinor,
    payeeId: row.payeeId,
    payeeName: row.payeeName,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    line: {
      id: row.lineId,
      amountMinor: row.amountMinor,
      categoryId: row.categoryId,
    },
  }
}

export function getTransaction(
  database: Database.Database,
  id: string,
): Transaction {
  return transactionView(
    database
      .prepare(`${TRANSACTION_SELECT} WHERE transactions.id = ?`)
      .get(id) as StoredTransaction | undefined,
  )
}

export function listTransactions(database: Database.Database): Transaction[] {
  return (
    database
      .prepare(
        `${TRANSACTION_SELECT} ORDER BY transactions.date DESC, transactions.created_at DESC, transactions.rowid DESC`,
      )
      .all() as StoredTransaction[]
  ).map(transactionView)
}

export function listPayees(database: Database.Database): Payee[] {
  return database
    .prepare(
      'SELECT id, name, created_at AS createdAt FROM payees ORDER BY name COLLATE NOCASE, rowid',
    )
    .all() as Payee[]
}

function resolvePayee(
  database: Database.Database,
  name: string | null,
  timestamp: string,
): string | null {
  if (name === null) return null
  const existing = database
    .prepare('SELECT id FROM payees WHERE name = ? COLLATE NOCASE')
    .get(name) as { id: string } | undefined
  if (existing) return existing.id
  const id = randomUUID()
  database
    .prepare('INSERT INTO payees (id, name, created_at) VALUES (?, ?, ?)')
    .run(id, name, timestamp)
  return id
}

function validateReferences(
  database: Database.Database,
  accountId: string,
  kind: 'expense' | 'income',
  categoryId: string | null,
): void {
  const account = database
    .prepare('SELECT archived FROM accounts WHERE id = ?')
    .get(accountId) as { archived: number } | undefined
  if (!account || account.archived)
    throw new Error('transactions.error.account')
  if (categoryId === null) return
  let category: ReturnType<typeof getCategory>
  let parentArchived = false
  try {
    category = getCategory(database, categoryId)
    parentArchived =
      category.parentId !== null &&
      getCategory(database, category.parentId).archived !== 0
  } catch {
    throw new Error('transactions.error.category')
  }
  if (category.kind !== kind || category.archived || parentArchived) {
    throw new Error('transactions.error.category')
  }
}

export function createTransaction(
  database: Database.Database,
  input: CreateTransactionInput,
  clock: () => Date,
): Transaction {
  const accountId = validateTransactionAccountId(input.accountId)
  const kind = validateTransactionKind(input.kind)
  const date = validateTransactionDate(input.date, clock)
  const totalMinor = validateTransactionTotal(input.totalMinor)
  const payeeName = validateTransactionPayeeName(input.payeeName)
  const categoryId = validateTransactionCategoryId(input.categoryId)
  const note = validateTransactionNote(input.note)
  validateReferences(database, accountId, kind, categoryId)
  const timestamp = clock().toISOString()
  const payeeId = resolvePayee(database, payeeName, timestamp)
  const id = randomUUID()
  database
    .prepare(
      `INSERT INTO transactions
        (id, account_id, kind, date, total_minor, payee_id, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      accountId,
      kind,
      date,
      totalMinor,
      payeeId,
      note,
      timestamp,
      timestamp,
    )
  database
    .prepare(
      `INSERT INTO transaction_lines
        (id, transaction_id, amount_minor, category_id) VALUES (?, ?, ?, ?)`,
    )
    .run(randomUUID(), id, totalMinor, categoryId)
  return getTransaction(database, id)
}

export function updateTransaction(
  database: Database.Database,
  input: UpdateTransactionInput,
  clock: () => Date,
): Transaction {
  const current = getTransaction(database, validateTransactionId(input.id))
  const accountId = validateTransactionAccountId(input.accountId)
  const kind = validateTransactionKind(input.kind)
  const date = validateTransactionDate(input.date, clock)
  const totalMinor = validateTransactionTotal(input.totalMinor)
  const payeeName = validateTransactionPayeeName(input.payeeName)
  const categoryId = validateTransactionCategoryId(input.categoryId)
  const note = validateTransactionNote(input.note)
  validateReferences(database, accountId, kind, categoryId)
  const timestamp = clock().toISOString()
  const payeeId = resolvePayee(database, payeeName, timestamp)
  database
    .prepare(
      `UPDATE transactions
       SET account_id = ?, kind = ?, date = ?, total_minor = ?, payee_id = ?,
         note = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      accountId,
      kind,
      date,
      totalMinor,
      payeeId,
      note,
      timestamp,
      current.id,
    )
  database
    .prepare(
      'UPDATE transaction_lines SET amount_minor = ?, category_id = ? WHERE id = ?',
    )
    .run(totalMinor, categoryId, current.line.id)
  return getTransaction(database, current.id)
}

export function deleteTransaction(
  database: Database.Database,
  id: string,
): void {
  const current = getTransaction(database, validateTransactionId(id))
  database
    .prepare('DELETE FROM transaction_lines WHERE transaction_id = ?')
    .run(current.id)
  database.prepare('DELETE FROM transactions WHERE id = ?').run(current.id)
}
