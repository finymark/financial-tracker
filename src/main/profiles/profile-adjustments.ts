import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type {
  BalanceAdjustment,
  CreateBalanceAdjustmentInput,
  UpdateBalanceAdjustmentInput,
} from '../../shared/adjustments'
import {
  validateBalanceAdjustmentAccountId,
  validateBalanceAdjustmentDate,
  validateBalanceAdjustmentId,
  validateBalanceAdjustmentNote,
  validateObservedBalance,
} from './adjustment-validation'
import { calculateAccountHistory } from './profile-account-movements'

interface StoredBalanceAdjustment {
  id: string
  accountId: string
  date: string
  observedMinor: number
  note: string
  createdAt: string
  updatedAt: string
}

const ADJUSTMENT_SELECT = `SELECT id, account_id AS accountId, date,
  observed_minor AS observedMinor, note, created_at AS createdAt,
  updated_at AS updatedAt FROM balance_adjustments`

function validateAccount(
  database: Database.Database,
  accountId: string,
  currentAccountId?: string,
): void {
  const account = database
    .prepare('SELECT archived FROM accounts WHERE id = ?')
    .get(accountId) as { archived: number } | undefined
  if (!account || (account.archived && accountId !== currentAccountId)) {
    throw new Error('adjustments.error.account')
  }
}

function adjustmentView(
  database: Database.Database,
  row: StoredBalanceAdjustment | undefined,
): BalanceAdjustment {
  if (!row) throw new Error('adjustments.error.notFound')
  const differenceMinor = calculateAccountHistory(
    database,
    row.accountId,
  ).adjustmentDifferences.get(row.id)
  if (differenceMinor === undefined)
    throw new Error('adjustments.error.notFound')
  return {
    ...row,
    kind: 'adjustment',
    differenceMinor,
    noLongerCorrectsAnything: differenceMinor === 0,
  }
}

function getStoredBalanceAdjustment(
  database: Database.Database,
  id: string,
): StoredBalanceAdjustment {
  const row = database
    .prepare(`${ADJUSTMENT_SELECT} WHERE id = ?`)
    .get(validateBalanceAdjustmentId(id)) as StoredBalanceAdjustment | undefined
  if (!row) throw new Error('adjustments.error.notFound')
  return row
}

export function getBalanceAdjustment(
  database: Database.Database,
  id: string,
): BalanceAdjustment {
  return adjustmentView(database, getStoredBalanceAdjustment(database, id))
}

export function createBalanceAdjustment(
  database: Database.Database,
  input: CreateBalanceAdjustmentInput,
  clock: () => Date,
): BalanceAdjustment {
  const accountId = validateBalanceAdjustmentAccountId(input.accountId)
  validateAccount(database, accountId)
  const timestamp = clock().toISOString()
  const id = randomUUID()
  database
    .prepare(
      `INSERT INTO balance_adjustments
        (id, account_id, date, observed_minor, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      accountId,
      validateBalanceAdjustmentDate(input.date, clock),
      validateObservedBalance(input.observedMinor),
      validateBalanceAdjustmentNote(input.note),
      timestamp,
      timestamp,
    )
  return getBalanceAdjustment(database, id)
}

export function updateBalanceAdjustment(
  database: Database.Database,
  input: UpdateBalanceAdjustmentInput,
  clock: () => Date,
): BalanceAdjustment {
  const current = getStoredBalanceAdjustment(
    database,
    validateBalanceAdjustmentId(input.id),
  )
  const accountId = validateBalanceAdjustmentAccountId(input.accountId)
  validateAccount(database, accountId, current.accountId)
  database
    .prepare(
      `UPDATE balance_adjustments SET account_id = ?, date = ?,
        observed_minor = ?, note = ?, updated_at = ? WHERE id = ?`,
    )
    .run(
      accountId,
      validateBalanceAdjustmentDate(input.date, clock),
      validateObservedBalance(input.observedMinor),
      validateBalanceAdjustmentNote(input.note),
      clock().toISOString(),
      current.id,
    )
  return getBalanceAdjustment(database, current.id)
}

export function deleteBalanceAdjustment(
  database: Database.Database,
  id: string,
): void {
  const current = getStoredBalanceAdjustment(database, id)
  database
    .prepare('DELETE FROM balance_adjustments WHERE id = ?')
    .run(current.id)
}
