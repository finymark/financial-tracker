import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type {
  CreateTransactionInput,
  TransactionListInput,
  TransactionPage,
  TransactionTotals,
  Transaction,
  TransactionFieldsInput,
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
import { getTransfers } from './profile-transfers'
import { resolvePayee } from './profile-payees'
import { validateTagNames } from './tag-validation'
import { getLinesTags, setLineTags } from './profile-tags'
import { getBalanceAdjustments } from './profile-adjustments'
import { foldTextKey } from '../../shared/text-keys'
import { resolvePresetDateRange } from './period-date-range'
import { listAttachments } from './profile-attachments'

type StoredTransactionPage = Omit<TransactionPage, 'baseTotals'>

interface StoredTransaction {
  id: string
  accountId: string
  kind: 'expense' | 'income'
  date: string
  totalMinor: number
  payeeId: string | null
  payeeName: string | null
  note: string
  excluded: number
  createdAt: string
  updatedAt: string
}

interface StoredTransactionLine {
  id: string
  amountMinor: number
  categoryId: string | null
  note: string
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

function transactionView(
  database: Database.Database,
  row: StoredTransaction | undefined,
): Transaction {
  if (!row) throw new Error('transactions.error.notFound')
  return transactionViews(database, [row])[0]
}

function transactionViews(
  database: Database.Database,
  rows: readonly StoredTransaction[],
): Transaction[] {
  if (rows.length === 0) return []
  const storedLines = database
    .prepare(
      `SELECT id, transaction_id AS transactionId,
        amount_minor AS amountMinor, category_id AS categoryId, note
       FROM transaction_lines
       WHERE transaction_id IN (${rows.map(() => '?').join(',')})
       ORDER BY rowid`,
    )
    .all(...rows.map((row) => row.id)) as (StoredTransactionLine & {
    transactionId: string
  })[]
  const lineTags = getLinesTags(
    database,
    storedLines.map((line) => line.id),
  )
  return rows.map((row) => {
    const transactionLines = storedLines.filter(
      (line) => line.transactionId === row.id,
    )
    const lineTotal = transactionLines.reduce(
      (sum, line) => sum + BigInt(line.amountMinor),
      0n,
    )
    if (transactionLines.length === 0 || lineTotal !== BigInt(row.totalMinor)) {
      throw new Error('transactions.error.lines')
    }
    const lines = transactionLines.map((line) => ({
      id: line.id,
      amountMinor: line.amountMinor,
      categoryId: line.categoryId,
      note: line.note,
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
      attachments: listAttachments(database, row.id),
    }
  })
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

export function getTransactions(
  database: Database.Database,
  ids: readonly string[],
): Transaction[] {
  if (ids.length === 0) return []
  const rows = database
    .prepare(
      `${TRANSACTION_SELECT}
       WHERE transactions.id IN (${ids.map(() => '?').join(',')})`,
    )
    .all(...ids) as StoredTransaction[]
  const byId = new Map(
    transactionViews(database, rows).map((transaction) => [
      transaction.id,
      transaction,
    ]),
  )
  return ids.map((id) => {
    const transaction = byId.get(id)
    if (!transaction) throw new Error('transactions.error.notFound')
    return transaction
  })
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
  input: TransactionFieldsInput,
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
  const insert = database.prepare(
    `INSERT INTO transaction_lines
      (id, transaction_id, amount_minor, category_id, note)
     VALUES (?, ?, ?, ?, ?)`,
  )
  lines.forEach((line, index) => {
    const id = reusableIds[index] ?? randomUUID()
    insert.run(id, transactionId, line.amountMinor, line.categoryId, line.note)
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

// Copy the ledger aggregate rather than reconstructing the single-line drawer
// input: every stored line and its tag associations keeps its own values.
export function duplicateTransaction(
  database: Database.Database,
  sourceId: string,
  clock: () => Date,
): string {
  const source = database
    .prepare('SELECT * FROM transactions WHERE id = ?')
    .get(validateTransactionId(sourceId)) as { excluded: number } | undefined
  if (!source) throw new Error('transactions.error.notFound')
  const id = randomUUID()
  const timestamp = clock().toISOString()
  database
    .prepare(
      `INSERT INTO transactions
    (id, account_id, kind, date, total_minor, payee_id, note, created_at, updated_at)
    SELECT ?, account_id, kind, ?, total_minor, payee_id, note, ?, ?
    FROM transactions WHERE id = ?`,
    )
    .run(id, today(clock), timestamp, timestamp, sourceId)
  database
    .prepare('UPDATE transactions SET excluded = ? WHERE id = ?')
    .run(source.excluded, id)
  const lines = database
    .prepare(
      'SELECT id FROM transaction_lines WHERE transaction_id = ? ORDER BY rowid',
    )
    .all(sourceId) as { id: string }[]
  for (const line of lines) {
    const lineId = randomUUID()
    database
      .prepare(
        `INSERT INTO transaction_lines
          (id, transaction_id, amount_minor, category_id, note)
         SELECT ?, ?, amount_minor, category_id, note
         FROM transaction_lines WHERE id = ?`,
      )
      .run(lineId, id, line.id)
    database
      .prepare(
        `INSERT INTO transaction_line_tags (line_id, tag_id)
        SELECT ?, tag_id FROM transaction_line_tags WHERE line_id = ?`,
      )
      .run(lineId, line.id)
  }
  return id
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
    input.lines === undefined && current.lines.length > 1
      ? (() => {
          if (totalMinor !== current.totalMinor)
            throw new Error('transactions.error.lines')
          return current.lines.map((line) => ({
            amountMinor: line.amountMinor,
            categoryId: line.categoryId,
            note: line.note,
            tagNames: line.tags.map((tag) => tag.name),
          }))
        })()
      : input.lines === undefined && input.tagNames === undefined
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
  if (
    database
      .prepare('SELECT 1 FROM transfers WHERE fee_transaction_id = ?')
      .get(transactionId)
  ) {
    throw new Error('transfers.error.linkedFee')
  }
}

function withFilteredMovements<Result>(
  database: Database.Database,
  value: TransactionListInput | undefined,
  clock: () => Date,
  read: (input: TransactionListInput) => Result,
): Result {
  const input = parseTransactionListInput(value)
  const where: string[] = []
  const parameters: (string | number)[] = []
  const transferWhere: string[] = []
  const transferParameters: (string | number)[] = []
  const adjustmentWhere: string[] = []
  const adjustmentParameters: (string | number)[] = []
  const add = (condition: string, ...values: (string | number)[]) => {
    where.push(condition)
    parameters.push(...values)
  }
  let from = input.from
  let to = input.to
  if (
    input.period === 'thisMonth' ||
    input.period === 'lastMonth' ||
    input.period === 'thisYear'
  ) {
    const range = resolvePresetDateRange(input.period, clock)
    from = range.from
    to = range.to
  }
  const addTransfer = (condition: string, ...values: (string | number)[]) => {
    transferWhere.push(condition)
    transferParameters.push(...values)
  }
  const addAdjustment = (condition: string, ...values: (string | number)[]) => {
    adjustmentWhere.push(condition)
    adjustmentParameters.push(...values)
  }
  if (from) {
    add('transactions.date >= ?', from)
    addTransfer('transfers.date >= ?', from)
    addAdjustment('balance_adjustments.date >= ?', from)
  }
  if (to) {
    add('transactions.date <= ?', to)
    addTransfer('transfers.date <= ?', to)
    addAdjustment('balance_adjustments.date <= ?', to)
  }
  if (input.accountId) {
    add('transactions.account_id = ?', input.accountId)
    addTransfer(
      '(transfers.from_account_id = ? OR transfers.to_account_id = ?)',
      input.accountId,
      input.accountId,
    )
    addAdjustment('balance_adjustments.account_id = ?', input.accountId)
  }
  if (input.exclusion === 'onlyExcluded') {
    add('transactions.excluded = 1')
    addTransfer('0 = 1')
    addAdjustment('0 = 1')
  }
  if (input.exclusion === 'hideExcluded') add('transactions.excluded = 0')
  if (input.payeeId) add('transactions.payee_id = ?', input.payeeId)
  if (input.payeeId) {
    addTransfer('0 = 1')
    addAdjustment('0 = 1')
  }
  if (input.kind) {
    add('transactions.kind = ?', input.kind)
    addTransfer('0 = 1')
    addAdjustment('0 = 1')
  }
  const filteredLineConditions = [
    'filter_lines.transaction_id = transactions.id',
  ]
  const filteredLineParameters: string[] = []
  if (input.categoryId) {
    filteredLineConditions.push(
      input.exactCategory
        ? 'filter_lines.category_id = ?'
        : `EXISTS (
        SELECT 1 FROM categories
        WHERE categories.id = filter_lines.category_id
          AND (categories.id = ? OR categories.parent_id = ?)
      )`,
    )
    filteredLineParameters.push(
      input.categoryId,
      ...(input.exactCategory ? [] : [input.categoryId]),
    )
  }
  if (input.uncategorized)
    filteredLineConditions.push('filter_lines.category_id IS NULL')
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
  if (input.categoryId || input.uncategorized || input.tagId) {
    add(
      `EXISTS (
        SELECT 1 FROM transaction_lines AS filter_lines
        WHERE ${filteredLineConditions.join(' AND ')}
      )`,
      ...filteredLineParameters,
    )
    addTransfer('0 = 1')
    addAdjustment('0 = 1')
  }
  if (input.search) {
    add(
      `(transactions.payee_id IN (
          SELECT id FROM payees WHERE instr(fold_text(name), ?) > 0
        ) OR instr(fold_text(transactions.note), ?) > 0
        OR EXISTS (
          SELECT 1 FROM transaction_lines AS searched_lines
          WHERE searched_lines.transaction_id = transactions.id
            AND instr(fold_text(searched_lines.note), ?) > 0
        ))`,
      foldTextKey(input.search),
      foldTextKey(input.search),
      foldTextKey(input.search),
    )
    addTransfer(
      'instr(fold_text(transfers.note), ?) > 0',
      foldTextKey(input.search),
    )
    addAdjustment(
      'instr(fold_text(balance_adjustments.note), ?) > 0',
      foldTextKey(input.search),
    )
  }
  const filtered = `FROM transactions
    JOIN accounts ON accounts.id = transactions.account_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`
  const filteredTransfers = `FROM transfers
    ${transferWhere.length ? `WHERE ${transferWhere.join(' AND ')}` : ''}`
  const filteredAdjustments = `FROM balance_adjustments
    ${adjustmentWhere.length ? `WHERE ${adjustmentWhere.join(' AND ')}` : ''}`
  // Materialize the filtered movement identity once. Page loading, count,
  // aggregates, and day groups then share this read snapshot without repeating
  // Unicode folding or the line predicates.
  return database.transaction(() => {
    database.exec(`CREATE TEMP TABLE IF NOT EXISTS filtered_movements (
      id TEXT NOT NULL,
      row_kind TEXT NOT NULL CHECK (row_kind IN ('transaction', 'transfer', 'adjustment')),
      date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (row_kind, id)
    ) WITHOUT ROWID`)
    database.prepare('DELETE FROM temp.filtered_movements').run()
    database
      .prepare(
        `INSERT INTO temp.filtered_movements (id, row_kind, date, created_at)
         SELECT transactions.id, 'transaction', transactions.date,
           transactions.created_at ${filtered}`,
      )
      .run(...parameters)
    database
      .prepare(
        `INSERT INTO temp.filtered_movements (id, row_kind, date, created_at)
         SELECT transfers.id, 'transfer', transfers.date, transfers.created_at
         ${filteredTransfers}`,
      )
      .run(...transferParameters)
    database
      .prepare(
        `INSERT INTO temp.filtered_movements (id, row_kind, date, created_at)
         SELECT balance_adjustments.id, 'adjustment',
           balance_adjustments.date, balance_adjustments.created_at
         ${filteredAdjustments}`,
      )
      .run(...adjustmentParameters)

    return read(input)
  })()
}

// CSV uses the same matched transaction identities as the list, but never its
// paging, transfer/adjustment rows, or spending aggregates.
export function listFilteredTransactions(
  database: Database.Database,
  input: TransactionListInput | undefined,
  clock: () => Date,
): Transaction[] {
  return withFilteredMovements(database, input, clock, () => {
    const ids = database
      .prepare(
        `
      SELECT id FROM temp.filtered_movements WHERE row_kind = 'transaction'
      ORDER BY date DESC, created_at DESC, id DESC
    `,
      )
      .all() as { id: string }[]
    const rows: Transaction[] = []
    for (let offset = 0; offset < ids.length; offset += 500) {
      rows.push(
        ...getTransactions(
          database,
          ids.slice(offset, offset + 500).map(({ id }) => id),
        ),
      )
    }
    return rows
  })
}

export function listTransactions(
  database: Database.Database,
  value: TransactionListInput | undefined,
  clock: () => Date,
): StoredTransactionPage {
  return withFilteredMovements(database, value, clock, (input) => {
    const pageRows = database
      .prepare(
        `SELECT id, row_kind AS rowKind FROM temp.filtered_movements
         ORDER BY date DESC, created_at DESC, id DESC LIMIT ? OFFSET ?`,
      )
      .all(input.limit!, input.offset!) as {
      id: string
      rowKind: 'transaction' | 'transfer' | 'adjustment'
    }[]
    const transactionIds = pageRows
      .filter((row) => row.rowKind === 'transaction')
      .map((row) => row.id)
    const transferIds = pageRows
      .filter((row) => row.rowKind === 'transfer')
      .map((row) => row.id)
    const adjustmentIds = pageRows
      .filter((row) => row.rowKind === 'adjustment')
      .map((row) => row.id)
    const transactions = new Map(
      getTransactions(database, transactionIds).map((transaction) => [
        transaction.id,
        transaction,
      ]),
    )
    const transfers = new Map(
      getTransfers(database, transferIds).map((transfer) => [
        transfer.id,
        transfer,
      ]),
    )
    const adjustments = new Map(
      getBalanceAdjustments(database, adjustmentIds).map((adjustment) => [
        adjustment.id,
        adjustment,
      ]),
    )
    const feeLinks = new Map(
      transactionIds.length === 0
        ? []
        : (
            database
              .prepare(
                `SELECT id, fee_transaction_id AS feeTransactionId
                 FROM transfers
                 WHERE fee_transaction_id IN (${transactionIds.map(() => '?').join(',')})`,
              )
              .all(...transactionIds) as {
              id: string
              feeTransactionId: string
            }[]
          ).map((row) => [row.feeTransactionId, row.id]),
    )
    const rows = pageRows.map(({ id, rowKind }) => {
      if (rowKind === 'transfer') return transfers.get(id)!
      if (rowKind === 'adjustment') return adjustments.get(id)!
      const transaction = transactions.get(id)!
      const linkedTransferId = feeLinks.get(id)
      return linkedTransferId
        ? { ...transaction, linkedTransferId }
        : transaction
    })
    const aggregates = database
      .prepare(
        `WITH aggregate_totals AS (
          SELECT movements.date, accounts.currency,
            SUM(CASE WHEN transactions.excluded = 0 AND transactions.kind = 'expense'
              THEN aggregate_lines.amount_minor ELSE 0 END) AS expenseMinor,
            SUM(CASE WHEN transactions.excluded = 0 AND transactions.kind = 'income'
              THEN aggregate_lines.amount_minor ELSE 0 END) AS incomeMinor
          FROM temp.filtered_movements AS movements
          JOIN transactions ON transactions.id = movements.id
          JOIN accounts ON accounts.id = transactions.account_id
          JOIN transaction_lines AS aggregate_lines
            ON aggregate_lines.transaction_id = transactions.id
          WHERE movements.row_kind = 'transaction'
          ${
            input.categoryId || input.uncategorized || input.tagId
              ? `AND ${[
                  input.categoryId
                    ? input.exactCategory
                      ? 'aggregate_lines.category_id = ?'
                      : `EXISTS (
                    SELECT 1 FROM categories AS aggregate_categories
                    WHERE aggregate_categories.id = aggregate_lines.category_id
                      AND (aggregate_categories.id = ? OR aggregate_categories.parent_id = ?)
                  )`
                    : '',
                  input.uncategorized
                    ? 'aggregate_lines.category_id IS NULL'
                    : '',
                  input.tagId
                    ? `EXISTS (
                    SELECT 1 FROM transaction_line_tags AS aggregate_tags
                    WHERE aggregate_tags.line_id = aggregate_lines.id
                      AND aggregate_tags.tag_id = ?
                  )`
                    : '',
                ]
                  .filter(Boolean)
                  .join(' AND ')}`
              : ''
          }
          GROUP BY movements.date, accounts.currency
        )
        SELECT date, currency, expenseMinor, incomeMinor,
          (SELECT COUNT(*) FROM temp.filtered_movements) AS totalCount
        FROM aggregate_totals
        UNION ALL
        SELECT NULL, NULL, 0, 0,
          (SELECT COUNT(*) FROM temp.filtered_movements)
        WHERE NOT EXISTS (SELECT 1 FROM aggregate_totals)
        ORDER BY date DESC, currency`,
      )
      .safeIntegers()
      .all(
        ...(input.categoryId
          ? [
              input.categoryId,
              ...(input.exactCategory ? [] : [input.categoryId]),
            ]
          : []),
        ...(input.tagId ? [input.tagId] : []),
      ) as {
      date: string | null
      currency: TransactionTotals['currency'] | null
      expenseMinor: bigint
      incomeMinor: bigint
      totalCount: bigint
    }[]
    const totalCount = Number(aggregates[0].totalCount)
    if (!Number.isSafeInteger(totalCount))
      throw new Error('transactions.error.totals')
    const totals = new Map<TransactionTotals['currency'], TransactionTotals>()
    const dayTotals = new Map<string, TransactionTotals[]>()
    const safe = (value: bigint): number => {
      const number = Number(value)
      if (!Number.isSafeInteger(number))
        throw new Error('transactions.error.totals')
      return number
    }
    for (const row of aggregates) {
      if (row.date === null || row.currency === null) continue
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
    const days = (
      database
        .prepare(
          'SELECT DISTINCT date FROM temp.filtered_movements ORDER BY date DESC',
        )
        .all() as { date: string }[]
    ).map(({ date }) => ({ date, totals: dayTotals.get(date) ?? [] }))
    return {
      rows,
      totalCount,
      totals: [...totals.values()].sort((a, b) =>
        a.currency.localeCompare(b.currency),
      ),
      days,
    }
  })
}
