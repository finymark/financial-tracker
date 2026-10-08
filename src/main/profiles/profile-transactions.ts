import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type {
  CreateTransactionInput,
  Payee,
  TransactionListInput,
  TransactionPage,
  TransactionTotals,
  Transaction,
  TransactionLineInput,
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
import { validateTagNames } from './tag-validation'
import { getLinesTags, setLineTags } from './profile-tags'
import { getTransfer } from './profile-transfers'

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
}

interface StoredTransactionLine {
  id: string
  amountMinor: number
  categoryId: string | null
  note?: string
}

const TRANSACTION_SELECT = `
  SELECT transactions.*,
    transactions.account_id AS accountId,
    transactions.total_minor AS totalMinor,
    transactions.payee_id AS payeeId,
    payees.name AS payeeName,
    transactions.created_at AS createdAt,
    transactions.updated_at AS updatedAt
  FROM transactions
  LEFT JOIN payees ON payees.id = transactions.payee_id`

function hasLineNotes(database: Database.Database): boolean {
  return (
    database.pragma('table_info(transaction_lines)') as { name: string }[]
  ).some((column) => column.name === 'note')
}

function transactionView(
  database: Database.Database,
  row: StoredTransaction | undefined,
): Transaction {
  if (!row) throw new Error('transactions.error.notFound')
  const lineNotes = hasLineNotes(database)
  const storedLines = database
    .prepare(
      `SELECT id, amount_minor AS amountMinor, category_id AS categoryId
        ${lineNotes ? ', note' : ''}
       FROM transaction_lines WHERE transaction_id = ? ORDER BY rowid`,
    )
    .all(row.id) as StoredTransactionLine[]
  const lineTotal = storedLines.reduce(
    (sum, line) => sum + BigInt(line.amountMinor),
    0n,
  )
  if (storedLines.length === 0 || lineTotal !== BigInt(row.totalMinor)) {
    throw new Error('transactions.error.lines')
  }
  const lineTags = getLinesTags(
    database,
    storedLines.map((line) => line.id),
  )
  const lines = storedLines.map((line) => ({
    id: line.id,
    amountMinor: line.amountMinor,
    categoryId: line.categoryId,
    note: line.note ?? row.note,
    tags: lineTags.get(line.id) ?? [],
  }))
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
    lines,
    line: lines[0],
  }
}

export function getTransaction(
  database: Database.Database,
  id: string,
): Transaction {
  return transactionView(
    database,
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
  categoryIds: readonly (string | null)[],
  current?: Pick<Transaction, 'accountId' | 'kind' | 'lines'>,
): void {
  const account = database
    .prepare('SELECT archived FROM accounts WHERE id = ?')
    .get(accountId) as { archived: number } | undefined
  if (!account || (account.archived && accountId !== current?.accountId))
    throw new Error('transactions.error.account')
  const currentCategoryIds = new Set(
    current?.lines.map((line) => line.categoryId) ?? [],
  )
  for (const categoryId of new Set(categoryIds)) {
    if (categoryId === null) continue
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
        !currentCategoryIds.has(categoryId))
    ) {
      throw new Error('transactions.error.category')
    }
  }
}

interface ValidatedLine extends TransactionLineInput {
  tagNames: string[]
}

function validateLines(
  input: CreateTransactionInput,
  totalMinor: number,
): ValidatedLine[] {
  if (input.lines === undefined) {
    return [
      {
        amountMinor: totalMinor,
        categoryId: validateTransactionCategoryId(input.categoryId),
        note: validateTransactionNote(input.note),
        tagNames: validateTagNames(input.tagNames),
      },
    ]
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0)
    throw new Error('transactions.error.lines')
  const lines = input.lines.map((line) => {
    if (!line || typeof line !== 'object' || Array.isArray(line))
      throw new Error('transactions.error.lines')
    let amountMinor: number
    try {
      amountMinor = validateTransactionTotal(line.amountMinor)
    } catch {
      throw new Error('transactions.error.lines')
    }
    return {
      amountMinor,
      categoryId: validateTransactionCategoryId(line.categoryId),
      note: validateTransactionNote(line.note),
      tagNames: validateTagNames(line.tagNames),
    }
  })
  const sum = lines.reduce(
    (total, line) => total + BigInt(line.amountMinor),
    0n,
  )
  if (sum !== BigInt(totalMinor)) throw new Error('transactions.error.lines')
  return lines
}

function insertLines(
  database: Database.Database,
  transactionId: string,
  lines: readonly ValidatedLine[],
  timestamp: string,
  reusableIds: readonly string[] = [],
): void {
  const lineNotes = hasLineNotes(database)
  const insert = database.prepare(
    lineNotes
      ? `INSERT INTO transaction_lines
          (id, transaction_id, amount_minor, category_id, note)
         VALUES (?, ?, ?, ?, ?)`
      : `INSERT INTO transaction_lines
          (id, transaction_id, amount_minor, category_id)
         VALUES (?, ?, ?, ?)`,
  )
  lines.forEach((line, index) => {
    const id = reusableIds[index] ?? randomUUID()
    if (lineNotes)
      insert.run(
        id,
        transactionId,
        line.amountMinor,
        line.categoryId,
        line.note,
      )
    else insert.run(id, transactionId, line.amountMinor, line.categoryId)
    setLineTags(database, id, line.tagNames, timestamp)
  })
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
  const note = validateTransactionNote(input.note)
  const lines = validateLines(input, totalMinor)
  const excluded = validateTransactionExcluded(input.excluded)
  validateReferences(
    database,
    accountId,
    kind,
    lines.map((line) => line.categoryId),
  )
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
  insertLines(database, id, lines, timestamp)
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
  allowLinkedFee = false,
): Transaction {
  const current = getTransaction(database, validateTransactionId(input.id))
  assertNotLinkedFee(database, current.id, allowLinkedFee)
  const accountId = validateTransactionAccountId(input.accountId)
  const kind = validateTransactionKind(input.kind)
  const date = validateTransactionDate(input.date, clock)
  const totalMinor = validateTransactionTotal(input.totalMinor)
  const payeeName = validateTransactionPayeeName(input.payeeName)
  const note = validateTransactionNote(input.note)
  const lines =
    input.lines === undefined && input.tagNames === undefined
      ? validateLines(
          {
            ...input,
            tagNames: current.line.tags.map((tag) => tag.name),
          },
          totalMinor,
        )
      : validateLines(input, totalMinor)
  const excluded = validateTransactionExcluded(input.excluded)
  validateReferences(
    database,
    accountId,
    kind,
    lines.map((line) => line.categoryId),
    current,
  )
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
    .prepare('DELETE FROM transaction_lines WHERE transaction_id = ?')
    .run(current.id)
  insertLines(
    database,
    current.id,
    lines,
    timestamp,
    current.lines.map((line) => line.id),
  )
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
  allowLinkedFee = false,
): void {
  const current = getTransaction(database, validateTransactionId(id))
  assertNotLinkedFee(database, current.id, allowLinkedFee)
  database
    .prepare('DELETE FROM transaction_lines WHERE transaction_id = ?')
    .run(current.id)
  database.prepare('DELETE FROM transactions WHERE id = ?').run(current.id)
}

function assertNotLinkedFee(
  database: Database.Database,
  transactionId: string,
  allowLinkedFee: boolean,
): void {
  if (allowLinkedFee) return
  const hasTransfers = Boolean(
    database
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'transfers'",
      )
      .get(),
  )
  if (
    hasTransfers &&
    database
      .prepare('SELECT 1 FROM transfers WHERE fee_transaction_id = ?')
      .get(transactionId)
  ) {
    throw new Error('transfers.error.linkedFee')
  }
}

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
  const transferWhere: string[] = []
  const transferParameters: (string | number)[] = []
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
  const addTransfer = (condition: string, ...values: (string | number)[]) => {
    transferWhere.push(condition)
    transferParameters.push(...values)
  }
  if (from) {
    add('transactions.date >= ?', from)
    addTransfer('transfers.date >= ?', from)
  }
  if (to) {
    add('transactions.date <= ?', to)
    addTransfer('transfers.date <= ?', to)
  }
  if (input.accountId) {
    add('transactions.account_id = ?', input.accountId)
    addTransfer(
      '(transfers.from_account_id = ? OR transfers.to_account_id = ?)',
      input.accountId,
      input.accountId,
    )
  }
  if (input.exclusion === 'onlyExcluded') {
    add('transactions.excluded = 1')
    addTransfer('0 = 1')
  }
  if (input.exclusion === 'hideExcluded') add('transactions.excluded = 0')
  if (input.payeeId) add('transactions.payee_id = ?', input.payeeId)
  if (input.payeeId) addTransfer('0 = 1')
  const filteredLineConditions = [
    'filter_lines.transaction_id = transactions.id',
  ]
  const filteredLineParameters: string[] = []
  if (input.categoryId) {
    filteredLineConditions.push(
      `EXISTS (
        SELECT 1 FROM categories
        WHERE categories.id = filter_lines.category_id
          AND (categories.id = ? OR categories.parent_id = ?)
      )`,
    )
    filteredLineParameters.push(input.categoryId, input.categoryId)
  }
  if (input.tagId) {
    filteredLineConditions.push(
      `EXISTS (
        SELECT 1 FROM transaction_line_tags
        WHERE transaction_line_tags.line_id = filter_lines.id
          AND transaction_line_tags.tag_id = ?
      )`,
    )
    filteredLineParameters.push(input.tagId)
  }
  if (input.categoryId || input.tagId) {
    add(
      `EXISTS (
        SELECT 1 FROM transaction_lines AS filter_lines
        WHERE ${filteredLineConditions.join(' AND ')}
      )`,
      ...filteredLineParameters,
    )
    addTransfer('0 = 1')
  }
  if (input.search) {
    add(
      `(instr(fold_text(payees.name), ?) > 0 OR instr(fold_text(transactions.note), ?) > 0
        ${
          hasLineNotes(database)
            ? `OR EXISTS (
          SELECT 1 FROM transaction_lines AS searched_lines
          WHERE searched_lines.transaction_id = transactions.id
            AND instr(fold_text(searched_lines.note), ?) > 0
        )`
            : ''
        })`,
      foldText(input.search),
      foldText(input.search),
      ...(hasLineNotes(database) ? [foldText(input.search)] : []),
    )
    addTransfer(
      'instr(fold_text(transfers.note), ?) > 0',
      foldText(input.search),
    )
  }
  const filtered = `FROM transactions
    JOIN accounts ON accounts.id = transactions.account_id
    LEFT JOIN payees ON payees.id = transactions.payee_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`
  const transfersAvailable = Boolean(
    database
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'transfers'",
      )
      .get(),
  )
  const includeTransfers =
    transfersAvailable &&
    Boolean(database.prepare('SELECT 1 FROM transfers LIMIT 1').get())
  const filteredTransfers = `FROM transfers
    ${transferWhere.length ? `WHERE ${transferWhere.join(' AND ')}` : ''}`
  const entries = `
    SELECT transactions.id, 'transaction' AS entryType,
      transactions.date, transactions.created_at AS createdAt ${filtered}
    ${
      includeTransfers
        ? `UNION ALL
    SELECT transfers.id, 'transfer' AS entryType,
      transfers.date, transfers.created_at AS createdAt ${filteredTransfers}`
        : ''
    }`
  const entryParameters = includeTransfers
    ? [...parameters, ...transferParameters]
    : parameters
  // One read snapshot for rows and aggregates. Offset allows arbitrary virtual
  // windows; only the bounded page goes through the ledger line checks.
  return database.transaction(() => {
    const rows = includeTransfers
      ? (
          database
            .prepare(
              `SELECT id, entryType FROM (${entries})
               ORDER BY date DESC, createdAt DESC, id DESC LIMIT ? OFFSET ?`,
            )
            .all(...entryParameters, input.limit!, input.offset!) as {
            id: string
            entryType: 'transaction' | 'transfer'
          }[]
        ).map(({ id, entryType }) => {
          if (entryType === 'transfer') return getTransfer(database, id)
          const transaction = getTransaction(database, id)
          const link = database
            .prepare('SELECT id FROM transfers WHERE fee_transaction_id = ?')
            .get(id) as { id: string } | undefined
          return link
            ? { ...transaction, linkedTransferId: link.id }
            : transaction
        })
      : (
          database
            .prepare(
              `SELECT transactions.id ${filtered}
               ORDER BY transactions.date DESC, transactions.created_at DESC,
                 transactions.id DESC LIMIT ? OFFSET ?`,
            )
            .all(...parameters, input.limit!, input.offset!) as { id: string }[]
        ).map(({ id }) => getTransaction(database, id))
    const totalCount = Number(
      (
        database
          .prepare(
            includeTransfers
              ? `SELECT COUNT(*) AS count FROM (${entries})`
              : `SELECT COUNT(*) AS count ${filtered}`,
          )
          .safeIntegers()
          .get(...(includeTransfers ? entryParameters : parameters)) as {
          count: bigint
        }
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
      ${
        input.categoryId || input.tagId
          ? `WHERE ${[
              input.categoryId
                ? `EXISTS (
          SELECT 1 FROM categories AS aggregate_categories
          WHERE aggregate_categories.id = aggregate_lines.category_id
            AND (aggregate_categories.id = ? OR aggregate_categories.parent_id = ?)
        )`
                : '',
              input.tagId
                ? `EXISTS (
          SELECT 1 FROM transaction_line_tags AS aggregate_tags
          WHERE aggregate_tags.line_id = aggregate_lines.id AND aggregate_tags.tag_id = ?
        )`
                : '',
            ]
              .filter(Boolean)
              .join(' AND ')}`
          : ''
      }
      GROUP BY filtered_transactions.date, filtered_transactions.currency
      ORDER BY filtered_transactions.date DESC, filtered_transactions.currency`,
      )
      .safeIntegers()
      .all(
        ...parameters,
        ...(input.categoryId ? [input.categoryId, input.categoryId] : []),
        ...(input.tagId ? [input.tagId] : []),
      ) as {
      date: string
      currency: TransactionTotals['currency']
      expenseMinor: bigint
      incomeMinor: bigint
    }[]
    const totals = new Map<TransactionTotals['currency'], TransactionTotals>()
    const dayTotals = new Map<string, TransactionTotals[]>()
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
      const currentDay = dayTotals.get(row.date) ?? []
      currentDay.push(dayTotal)
      dayTotals.set(row.date, currentDay)
      const total = totals.get(row.currency) ?? {
        currency: row.currency,
        expenseMinor: 0,
        incomeMinor: 0,
      }
      total.expenseMinor = safe(BigInt(total.expenseMinor) + row.expenseMinor)
      total.incomeMinor = safe(BigInt(total.incomeMinor) + row.incomeMinor)
      totals.set(row.currency, total)
    }
    const days = includeTransfers
      ? (
          database
            .prepare(
              `SELECT DISTINCT date FROM (${entries}) ORDER BY date DESC`,
            )
            .all(...entryParameters) as { date: string }[]
        ).map(({ date }) => ({ date, totals: dayTotals.get(date) ?? [] }))
      : [...dayTotals].map(([date, totals]) => ({ date, totals }))
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
