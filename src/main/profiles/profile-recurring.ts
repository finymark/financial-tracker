import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  dueDates,
  type ConfirmPendingTransactionInput,
  type CreateRecurringTransactionInput,
  type PendingTransaction,
  type RecurringSchedule,
  type RecurringTransaction,
  type UpdateRecurringTransactionInput,
} from '../../shared/recurring'
import type { Transaction } from '../../shared/transactions'
import { today } from '../../shared/date'
import {
  recurringFields,
  validatePendingId,
  validateRecurringId,
} from './recurring-validation'
import {
  validateTransactionDate,
  validateTransactionTotal,
} from './transaction-validation'
import { resolvePayee } from './profile-payees'
import { getTransaction } from './profile-transactions'

interface StoredRecurring {
  id: string
  kind: 'expense' | 'income'
  accountId: string
  amountMinor: number
  payeeName: string | null
  categoryId: string | null
  note: string
  scheduleType: RecurringSchedule['type']
  scheduleDay: number | null
  scheduleMonth: number | null
  scheduleWeekday: number | null
  scheduleInterval: number | null
  startDate: string
  endDate: string | null
  paused: number
  generatedThrough: string
  createdAt: string
  updatedAt: string
}

const RECURRING_SELECT = `SELECT id, kind, account_id AS accountId,
  amount_minor AS amountMinor, payee_name AS payeeName,
  category_id AS categoryId, note, schedule_type AS scheduleType,
  schedule_day AS scheduleDay, schedule_month AS scheduleMonth,
  schedule_weekday AS scheduleWeekday, schedule_interval AS scheduleInterval,
  start_date AS startDate, end_date AS endDate, paused,
  generated_through AS generatedThrough, created_at AS createdAt,
  updated_at AS updatedAt FROM recurring_transactions`

function scheduleFromRow(row: StoredRecurring): RecurringSchedule {
  if (row.scheduleType === 'monthly')
    return {
      type: 'monthly',
      day: row.scheduleDay!,
      intervalMonths: row.scheduleInterval!,
    }
  if (row.scheduleType === 'weekly')
    return {
      type: 'weekly',
      weekday: row.scheduleWeekday!,
      intervalWeeks: row.scheduleInterval!,
    }
  return { type: 'yearly', month: row.scheduleMonth!, day: row.scheduleDay! }
}

function tagsByOwner(
  database: Database.Database,
  table: 'recurring_transaction_tags' | 'pending_transaction_tags',
  ownerColumn: 'recurring_id' | 'pending_id',
  ids: readonly string[],
): Map<string, string[]> {
  const result = new Map<string, string[]>()
  if (ids.length === 0) return result
  const rows = database
    .prepare(
      `SELECT ${ownerColumn} AS ownerId, tag_id AS tagId FROM ${table}
     WHERE ${ownerColumn} IN (${ids.map(() => '?').join(',')})
     ORDER BY tag_id`,
    )
    .all(...ids) as { ownerId: string; tagId: string }[]
  for (const row of rows)
    result.set(row.ownerId, [...(result.get(row.ownerId) ?? []), row.tagId])
  return result
}

function recurringViews(
  database: Database.Database,
  rows: readonly StoredRecurring[],
): RecurringTransaction[] {
  const tags = tagsByOwner(
    database,
    'recurring_transaction_tags',
    'recurring_id',
    rows.map((row) => row.id),
  )
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    accountId: row.accountId,
    amountMinor: row.amountMinor,
    payeeName: row.payeeName,
    categoryId: row.categoryId,
    tagIds: tags.get(row.id) ?? [],
    note: row.note,
    schedule: scheduleFromRow(row),
    startDate: row.startDate,
    endDate: row.endDate,
    paused: row.paused === 1,
    generatedThrough: row.generatedThrough,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }))
}

export function listRecurringTransactions(
  database: Database.Database,
): RecurringTransaction[] {
  return recurringViews(
    database,
    database
      .prepare(`${RECURRING_SELECT} ORDER BY created_at, id`)
      .all() as StoredRecurring[],
  )
}

export function getRecurringTransaction(
  database: Database.Database,
  id: string,
): RecurringTransaction {
  const row = database
    .prepare(`${RECURRING_SELECT} WHERE id = ?`)
    .get(validateRecurringId(id)) as StoredRecurring | undefined
  if (!row) throw new Error('recurring.error.notFound')
  return recurringViews(database, [row])[0]
}

function validateReferences(
  database: Database.Database,
  input: ReturnType<typeof recurringFields>,
  current?: RecurringTransaction,
): void {
  const account = database
    .prepare('SELECT archived FROM accounts WHERE id = ?')
    .get(input.accountId) as { archived: number } | undefined
  if (!account || (account.archived && input.accountId !== current?.accountId))
    throw new Error('recurring.error.reference')
  if (input.categoryId) {
    const category = database
      .prepare(
        `SELECT category.kind, category.archived,
          COALESCE(parent.archived, 0) AS parentArchived
         FROM categories AS category
         LEFT JOIN categories AS parent ON parent.id = category.parent_id
         WHERE category.id = ?`,
      )
      .get(input.categoryId) as
      { kind: string; archived: number; parentArchived: number } | undefined
    if (
      !category ||
      ((category.archived || category.parentArchived) &&
        input.categoryId !== current?.categoryId) ||
      category.kind !== input.kind
    )
      throw new Error('recurring.error.reference')
  }
  for (const id of input.tagIds)
    if (!database.prepare('SELECT 1 FROM tags WHERE id = ?').get(id))
      throw new Error('recurring.error.reference')
}

function previousDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

function scheduleColumns(
  schedule: RecurringSchedule,
): [string, number | null, number | null, number | null, number | null] {
  if (schedule.type === 'monthly')
    return ['monthly', schedule.day, null, null, schedule.intervalMonths]
  if (schedule.type === 'weekly')
    return ['weekly', null, null, schedule.weekday, schedule.intervalWeeks]
  return ['yearly', schedule.day, schedule.month, null, null]
}

function replaceTags(
  database: Database.Database,
  id: string,
  tagIds: readonly string[],
): void {
  database
    .prepare('DELETE FROM recurring_transaction_tags WHERE recurring_id = ?')
    .run(id)
  const insert = database.prepare(
    'INSERT INTO recurring_transaction_tags (recurring_id, tag_id) VALUES (?, ?)',
  )
  for (const tagId of tagIds) insert.run(id, tagId)
}

export function createRecurringTransaction(
  database: Database.Database,
  input: CreateRecurringTransactionInput,
  clock: () => Date,
): RecurringTransaction {
  const fields = recurringFields(input)
  validateReferences(database, fields)
  const id = randomUUID()
  const timestamp = clock().toISOString()
  const creationDate = today(clock)
  const firstEligible =
    fields.startDate > creationDate ? fields.startDate : creationDate
  const schedule = scheduleColumns(fields.schedule)
  database
    .prepare(
      `INSERT INTO recurring_transactions
    (id, kind, account_id, amount_minor, payee_name, category_id, note,
     schedule_type, schedule_day, schedule_month, schedule_weekday, schedule_interval,
     start_date, end_date, paused, generated_through, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    )
    .run(
      id,
      fields.kind,
      fields.accountId,
      fields.amountMinor,
      fields.payeeName,
      fields.categoryId,
      fields.note,
      ...schedule,
      fields.startDate,
      fields.endDate,
      previousDate(firstEligible),
      timestamp,
      timestamp,
    )
  replaceTags(database, id, fields.tagIds)
  return getRecurringTransaction(database, id)
}

export function updateRecurringTransaction(
  database: Database.Database,
  input: UpdateRecurringTransactionInput,
  clock: () => Date,
): RecurringTransaction {
  const current = getRecurringTransaction(database, input.id)
  const fields = recurringFields(input)
  validateReferences(database, fields, current)
  const schedule = scheduleColumns(fields.schedule)
  database
    .prepare(
      `UPDATE recurring_transactions SET kind = ?, account_id = ?,
    amount_minor = ?, payee_name = ?, category_id = ?, note = ?, schedule_type = ?,
    schedule_day = ?, schedule_month = ?, schedule_weekday = ?, schedule_interval = ?,
    start_date = ?, end_date = ?, updated_at = ? WHERE id = ?`,
    )
    .run(
      fields.kind,
      fields.accountId,
      fields.amountMinor,
      fields.payeeName,
      fields.categoryId,
      fields.note,
      ...schedule,
      fields.startDate,
      fields.endDate,
      clock().toISOString(),
      current.id,
    )
  replaceTags(database, current.id, fields.tagIds)
  return getRecurringTransaction(database, current.id)
}

export function setRecurringPaused(
  database: Database.Database,
  id: string,
  paused: boolean,
  clock: () => Date,
): void {
  const recurring = getRecurringTransaction(database, id)
  database
    .prepare(
      `UPDATE recurring_transactions SET paused = ?,
    generated_through = CASE WHEN ? = 0 THEN ? ELSE generated_through END,
    updated_at = ? WHERE id = ?`,
    )
    .run(
      Number(paused),
      Number(paused),
      previousDate(today(clock)),
      clock().toISOString(),
      recurring.id,
    )
}

export function deleteRecurringTransaction(
  database: Database.Database,
  id: string,
): void {
  const recurring = getRecurringTransaction(database, id)
  database
    .prepare('DELETE FROM recurring_transactions WHERE id = ?')
    .run(recurring.id)
}

function pendingTransactionViews(
  database: Database.Database,
  where: string,
  parameters: readonly string[],
): PendingTransaction[] {
  const rows = database
    .prepare(
      `SELECT id, recurring_id AS recurringId,
    due_date AS dueDate, kind, account_id AS accountId, amount_minor AS amountMinor,
    payee_name AS payeeName, category_id AS categoryId, note,
    status, confirmed_transaction_id AS confirmedTransactionId,
    created_at AS createdAt FROM pending_transactions
    WHERE ${where} ORDER BY due_date, created_at, id`,
    )
    .all(...parameters) as Omit<PendingTransaction, 'tagIds'>[]
  const tags = tagsByOwner(
    database,
    'pending_transaction_tags',
    'pending_id',
    rows.map((row) => row.id),
  )
  return rows.map((row) => ({ ...row, tagIds: tags.get(row.id) ?? [] }))
}

export function listPendingTransactions(
  database: Database.Database,
): PendingTransaction[] {
  return pendingTransactionViews(database, "status = 'pending'", [])
}

export function listRecurringTransactionOccurrences(
  database: Database.Database,
  recurringId: string,
): PendingTransaction[] {
  return pendingTransactionViews(database, 'recurring_id = ?', [recurringId])
}

export function getPendingTransaction(
  database: Database.Database,
  id: string,
): PendingTransaction {
  const validatedId = validatePendingId(id)
  const row = database
    .prepare(
      `SELECT id, recurring_id AS recurringId, due_date AS dueDate, kind,
      account_id AS accountId, amount_minor AS amountMinor,
      payee_name AS payeeName, category_id AS categoryId, note, status,
      confirmed_transaction_id AS confirmedTransactionId,
      created_at AS createdAt FROM pending_transactions WHERE id = ?`,
    )
    .get(validatedId) as Omit<PendingTransaction, 'tagIds'> | undefined
  if (!row) throw new Error('pending.error.notFound')
  const tags = tagsByOwner(database, 'pending_transaction_tags', 'pending_id', [
    row.id,
  ])
  return { ...row, tagIds: tags.get(row.id) ?? [] }
}

export function getDuePendingTransactionCount(
  database: Database.Database,
  clock: () => Date,
): number {
  const row = database
    .prepare(
      `SELECT COUNT(*) AS count FROM pending_transactions
       WHERE status = 'pending' AND due_date <= ?`,
    )
    .get(today(clock)) as { count: number }
  return row.count
}

export function confirmPendingTransaction(
  database: Database.Database,
  input: ConfirmPendingTransactionInput,
  clock: () => Date,
): Transaction {
  const pending = getPendingTransaction(database, input.id)
  if (pending.status !== 'pending') throw new Error('pending.error.notPending')
  const account = database
    .prepare('SELECT archived FROM accounts WHERE id = ?')
    .get(pending.accountId) as { archived: number } | undefined
  if (!account || account.archived)
    throw new Error('pending.error.accountArchived')
  const amountMinor = validateTransactionTotal(
    input.amountMinor ?? pending.amountMinor,
  )
  const date = validateTransactionDate(input.date ?? pending.dueDate, clock)
  const timestamp = clock().toISOString()
  const transactionId = randomUUID()
  const lineId = randomUUID()
  const payeeId = resolvePayee(database, pending.payeeName, timestamp)
  database
    .prepare(
      `INSERT INTO transactions
      (id, account_id, kind, date, total_minor, payee_id, note, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      transactionId,
      pending.accountId,
      pending.kind,
      date,
      amountMinor,
      payeeId,
      pending.note,
      timestamp,
      timestamp,
    )
  database
    .prepare(
      `INSERT INTO transaction_lines
      (id, transaction_id, amount_minor, category_id, note)
      VALUES (?, ?, ?, ?, ?)`,
    )
    .run(lineId, transactionId, amountMinor, pending.categoryId, pending.note)
  const insertTag = database.prepare(
    'INSERT INTO transaction_line_tags (line_id, tag_id) VALUES (?, ?)',
  )
  for (const tagId of pending.tagIds) insertTag.run(lineId, tagId)
  const changed = database
    .prepare(
      `UPDATE pending_transactions SET status = 'confirmed',
       confirmed_transaction_id = ? WHERE id = ? AND status = 'pending'`,
    )
    .run(transactionId, pending.id)
  if (changed.changes !== 1) throw new Error('pending.error.notPending')
  return getTransaction(database, transactionId)
}

export function skipPendingTransaction(
  database: Database.Database,
  id: string,
): void {
  const pending = getPendingTransaction(database, id)
  if (pending.status !== 'pending') throw new Error('pending.error.notPending')
  const changed = database
    .prepare(
      `UPDATE pending_transactions SET status = 'skipped',
       confirmed_transaction_id = NULL WHERE id = ? AND status = 'pending'`,
    )
    .run(pending.id)
  if (changed.changes !== 1) throw new Error('pending.error.notPending')
}

function generateRecurringTransactionRows(
  database: Database.Database,
  clock: () => Date,
  recurringTransactions: readonly RecurringTransaction[],
): void {
  const to = today(clock)
  const insertPending =
    database.prepare(`INSERT OR IGNORE INTO pending_transactions
    (id, recurring_id, due_date, kind, account_id, amount_minor, payee_name,
     category_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const insertTag = database.prepare(
    'INSERT OR IGNORE INTO pending_transaction_tags (pending_id, tag_id) VALUES (?, ?)',
  )
  const advance = database.prepare(
    'UPDATE recurring_transactions SET generated_through = ? WHERE id = ?',
  )
  for (const recurring of recurringTransactions) {
    if (recurring.paused || recurring.generatedThrough >= to) continue
    for (const dueDate of dueDates(
      recurring.schedule,
      recurring.startDate,
      recurring.endDate,
      recurring.generatedThrough,
      to,
    )) {
      const id = randomUUID()
      const inserted = insertPending.run(
        id,
        recurring.id,
        dueDate,
        recurring.kind,
        recurring.accountId,
        recurring.amountMinor,
        recurring.payeeName,
        recurring.categoryId,
        recurring.note,
        clock().toISOString(),
      )
      if (inserted.changes > 0)
        for (const tagId of recurring.tagIds) insertTag.run(id, tagId)
    }
    advance.run(to, recurring.id)
  }
}

export function generateRecurringTransaction(
  database: Database.Database,
  id: string,
  clock: () => Date,
): void {
  generateRecurringTransactionRows(database, clock, [
    getRecurringTransaction(database, id),
  ])
}

export function generateRecurringTransactions(
  database: Database.Database,
  clock: () => Date,
): void {
  if (
    !database
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'recurring_transactions'",
      )
      .get()
  )
    return
  generateRecurringTransactionRows(
    database,
    clock,
    listRecurringTransactions(database),
  )
}

export function storeRecurringTransaction(
  database: Database.Database,
  item: RecurringTransaction,
): void {
  const schedule = scheduleColumns(item.schedule)
  database
    .prepare(
      `INSERT INTO recurring_transactions
    (id, kind, account_id, amount_minor, payee_name, category_id, note,
     schedule_type, schedule_day, schedule_month, schedule_weekday, schedule_interval,
     start_date, end_date, paused, generated_through, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, account_id=excluded.account_id,
    amount_minor=excluded.amount_minor, payee_name=excluded.payee_name,
    category_id=excluded.category_id, note=excluded.note,
    schedule_type=excluded.schedule_type, schedule_day=excluded.schedule_day,
    schedule_month=excluded.schedule_month, schedule_weekday=excluded.schedule_weekday,
    schedule_interval=excluded.schedule_interval, start_date=excluded.start_date,
    end_date=excluded.end_date, paused=excluded.paused,
    generated_through=excluded.generated_through, created_at=excluded.created_at,
    updated_at=excluded.updated_at`,
    )
    .run(
      item.id,
      item.kind,
      item.accountId,
      item.amountMinor,
      item.payeeName,
      item.categoryId,
      item.note,
      ...schedule,
      item.startDate,
      item.endDate,
      Number(item.paused),
      item.generatedThrough,
      item.createdAt,
      item.updatedAt,
    )
  replaceTags(database, item.id, item.tagIds)
}

export function storePendingTransaction(
  database: Database.Database,
  item: PendingTransaction,
): void {
  database
    .prepare(
      `INSERT INTO pending_transactions
    (id, recurring_id, due_date, kind, account_id, amount_minor, payee_name,
     category_id, note, status, confirmed_transaction_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      item.id,
      item.recurringId,
      item.dueDate,
      item.kind,
      item.accountId,
      item.amountMinor,
      item.payeeName,
      item.categoryId,
      item.note,
      item.status,
      item.confirmedTransactionId,
      item.createdAt,
    )
  const insert = database.prepare(
    'INSERT INTO pending_transaction_tags (pending_id, tag_id) VALUES (?, ?)',
  )
  for (const tagId of item.tagIds) insert.run(item.id, tagId)
}
