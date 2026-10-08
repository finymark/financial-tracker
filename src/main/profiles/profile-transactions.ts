import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type {
  CreateTransactionInput,
  Payee,
  TransactionListInput,
  TransactionPage,
  TransactionTotals,
  Transaction,
  UpdateTransactionInput,
} from '../../shared/transactions'
import { getCategory } from './profile-categories'
import {
  parseTransactionListInput,
  validateTransactionAccountId,
  validateTransactionCategoryId,
  validateTransactionDate,
  validateTransactionKind,
  validateTransactionNote,
  validateTransactionPayeeName,
  validateTransactionTotal,
  validateTransactionId,
  validateTransactionExcluded,
} from './transaction-validation'
import { today } from '../../shared/date'
import { normalizePayeeKey } from '../db'

interface StoredTransaction {
  id: string
  accountId: string
  kind: 'expense' | 'income'
  date: string
  totalMinor: number
  payeeId: string | null
  payeeName: string | null
  note: string
  // Absent in pre-exclusion migration fixtures.
  excluded?: number
  createdAt: string
  updatedAt: string
  lineId: string
  amountMinor: number
  categoryId: string | null
  lineCount: number
  lineTotal: number
}

const TRANSACTION_SELECT = `
  SELECT transactions.*,
    transactions.account_id AS accountId,
    transactions.total_minor AS totalMinor,
    transactions.payee_id AS payeeId,
    payees.name AS payeeName,
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
    excluded: row.excluded === 1,
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
  const hasNormalizedName = (
    database.pragma('table_info(payees)') as { name: string }[]
  ).some((column) => column.name === 'normalized_name')
  const existing = (
    hasNormalizedName
      ? database
          .prepare('SELECT id FROM payees WHERE normalized_name = ?')
          .get(normalizePayeeKey(name))
      : database
          .prepare('SELECT id FROM payees WHERE name = ? COLLATE NOCASE')
          .get(name)
  ) as { id: string } | undefined
  if (existing) return existing.id
  const id = randomUUID()
  if (hasNormalizedName) {
    database
      .prepare(
        'INSERT INTO payees (id, name, normalized_name, created_at) VALUES (?, ?, ?, ?)',
      )
      .run(id, name, normalizePayeeKey(name), timestamp)
  } else {
    database
      .prepare('INSERT INTO payees (id, name, created_at) VALUES (?, ?, ?)')
      .run(id, name, timestamp)
  }
  return id
}

function validateReferences(
  database: Database.Database,
  accountId: string,
  kind: 'expense' | 'income',
  categoryId: string | null,
  current?: Pick<Transaction, 'accountId' | 'kind' | 'line'>,
): void {
  const account = database
    .prepare('SELECT archived FROM accounts WHERE id = ?')
    .get(accountId) as { archived: number } | undefined
  if (!account || (account.archived && accountId !== current?.accountId))
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
  if (
    category.kind !== kind ||
    ((category.archived || parentArchived) &&
      categoryId !== current?.line.categoryId)
  ) {
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
  const excluded = validateTransactionExcluded(input.excluded)
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
  if (excluded !== undefined) {
    database
      .prepare('UPDATE transactions SET excluded = ? WHERE id = ?')
      .run(Number(excluded), id)
  }
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
  const excluded = validateTransactionExcluded(input.excluded)
  validateReferences(database, accountId, kind, categoryId, current)
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
  if (excluded !== undefined) {
    database
      .prepare('UPDATE transactions SET excluded = ? WHERE id = ?')
      .run(Number(excluded), current.id)
  }
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

const LIST_ORDER =
  'transactions.date DESC, transactions.created_at DESC, transactions.id DESC'

function foldText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export function listTransactions(
  database: Database.Database,
  value: TransactionListInput | undefined,
  clock: () => Date,
): TransactionPage {
  const input = parseTransactionListInput(value)
  const where: string[] = []
  const parameters: (string | number)[] = []
  const add = (condition: string, ...values: (string | number)[]) => {
    where.push(condition)
    parameters.push(...values)
  }
  const current = today(clock)
  let from = input.from
  let to = input.to
  if (input.period === 'thisMonth') {
    from = `${current.slice(0, 7)}-01`
    to = current
  } else if (input.period === 'thisYear') {
    from = `${current.slice(0, 4)}-01-01`
    to = current
  } else if (input.period === 'lastMonth') {
    const first = new Date(`${current.slice(0, 7)}-01T12:00:00`)
    first.setDate(0)
    const last = today(() => first)
    from = `${last.slice(0, 7)}-01`
    to = last
  }
  if (from) add('transactions.date >= ?', from)
  if (to) add('transactions.date <= ?', to)
  if (input.exclusion === 'onlyExcluded') add('transactions.excluded = 1')
  if (input.exclusion === 'hideExcluded') add('transactions.excluded = 0')
  if (input.accountId) add('transactions.account_id = ?', input.accountId)
  if (input.payeeId) add('transactions.payee_id = ?', input.payeeId)
  if (input.categoryId)
    add(
      `EXISTS (
    SELECT 1 FROM transaction_lines AS filter_lines
    JOIN categories ON categories.id = filter_lines.category_id
    WHERE filter_lines.transaction_id = transactions.id
      AND (categories.id = ? OR categories.parent_id = ?)
  )`,
      input.categoryId,
      input.categoryId,
    )
  if (input.search) {
    add(
      '(instr(fold_text(payees.name), ?) > 0 OR instr(fold_text(transactions.note), ?) > 0)',
      foldText(input.search),
      foldText(input.search),
    )
  }
  const filtered = `FROM transactions
    JOIN accounts ON accounts.id = transactions.account_id
    LEFT JOIN payees ON payees.id = transactions.payee_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`
  // One read snapshot for rows and aggregates. Offset allows arbitrary virtual
  // windows; only the bounded page goes through the ledger line checks.
  return database.transaction(() => {
    const rows = (
      database
        .prepare(
          `${TRANSACTION_SELECT}
      WHERE transactions.id IN (SELECT transactions.id ${filtered}
        ORDER BY ${LIST_ORDER} LIMIT ? OFFSET ?)
      ORDER BY ${LIST_ORDER}`,
        )
        .all(...parameters, input.limit!, input.offset!) as StoredTransaction[]
    ).map(transactionView)
    const totalCount = Number(
      (
        database
          .prepare(`SELECT COUNT(*) AS count ${filtered}`)
          .safeIntegers()
          .get(...parameters) as { count: bigint }
      ).count,
    )
    if (!Number.isSafeInteger(totalCount))
      throw new Error('transactions.error.totals')
    const aggregates = database
      .prepare(
        `SELECT filtered_transactions.date, filtered_transactions.currency,
      SUM(CASE WHEN filtered_transactions.excluded = 0 AND filtered_transactions.kind = 'expense' THEN aggregate_lines.amount_minor ELSE 0 END) AS expenseMinor,
      SUM(CASE WHEN filtered_transactions.excluded = 0 AND filtered_transactions.kind = 'income' THEN aggregate_lines.amount_minor ELSE 0 END) AS incomeMinor
      FROM (
        SELECT transactions.id, transactions.date, transactions.kind, transactions.excluded, accounts.currency
        ${filtered}
      ) AS filtered_transactions
      JOIN transaction_lines AS aggregate_lines
        ON aggregate_lines.transaction_id = filtered_transactions.id
      GROUP BY filtered_transactions.date, filtered_transactions.currency
      ORDER BY filtered_transactions.date DESC, filtered_transactions.currency`,
      )
      .safeIntegers()
      .all(...parameters) as {
      date: string
      currency: TransactionTotals['currency']
      expenseMinor: bigint
      incomeMinor: bigint
    }[]
    const totals = new Map<TransactionTotals['currency'], TransactionTotals>()
    const days: TransactionPage['days'] = []
    const safe = (value: bigint): number => {
      const number = Number(value)
      if (!Number.isSafeInteger(number))
        throw new Error('transactions.error.totals')
      return number
    }
    for (const row of aggregates) {
      const dayTotal = {
        currency: row.currency,
        expenseMinor: safe(row.expenseMinor),
        incomeMinor: safe(row.incomeMinor),
      }
      if (days.at(-1)?.date !== row.date)
        days.push({ date: row.date, totals: [] })
      days.at(-1)!.totals.push(dayTotal)
      const total = totals.get(row.currency) ?? {
        currency: row.currency,
        expenseMinor: 0,
        incomeMinor: 0,
      }
      total.expenseMinor = safe(BigInt(total.expenseMinor) + row.expenseMinor)
      total.incomeMinor = safe(BigInt(total.incomeMinor) + row.incomeMinor)
      totals.set(row.currency, total)
    }
    return {
      rows,
      totalCount,
      totals: [...totals.values()].sort((a, b) =>
        a.currency.localeCompare(b.currency),
      ),
      days,
    }
  })()
}
