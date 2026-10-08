import type Database from 'better-sqlite3'
import type {
  BalanceAdjustment,
  CreateBalanceAdjustmentInput,
  UpdateBalanceAdjustmentInput,
} from '../../shared/adjustments'
import {
  createBalanceAdjustment,
  deleteBalanceAdjustment,
  updateBalanceAdjustment,
} from './profile-adjustments'
import type { UndoableCommand } from './undo-history'

interface BalanceAdjustmentImage {
  id: string
  accountId: string
  date: string
  observedMinor: number
  note: string
  createdAt: string
  updatedAt: string
}

function capture(
  database: Database.Database,
  id: string | null,
): BalanceAdjustmentImage | null {
  if (!id) return null
  return (
    (database
      .prepare(
        `SELECT id, account_id AS accountId, date,
          observed_minor AS observedMinor, note,
          created_at AS createdAt, updated_at AS updatedAt
         FROM balance_adjustments WHERE id = ?`,
      )
      .get(id) as BalanceAdjustmentImage | undefined) ?? null
  )
}

function restore(
  database: Database.Database,
  before: BalanceAdjustmentImage | null,
  after: BalanceAdjustmentImage | null,
): void {
  const id = before?.id ?? after?.id
  if (id)
    database.prepare('DELETE FROM balance_adjustments WHERE id = ?').run(id)
  if (before) {
    database
      .prepare(
        `INSERT INTO balance_adjustments
          (id, account_id, date, observed_minor, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        before.id,
        before.accountId,
        before.date,
        before.observedMinor,
        before.note,
        before.createdAt,
        before.updatedAt,
      )
  }
}

export function createBalanceAdjustmentUndoableCommand(
  database: Database.Database,
  input: CreateBalanceAdjustmentInput,
  clock: () => Date,
): UndoableCommand<null, BalanceAdjustmentImage | null, BalanceAdjustment> {
  return {
    captureBefore: () => null,
    execute: () => createBalanceAdjustment(database, input, clock),
    captureAfter: (result) => capture(database, result.id),
    restoreBefore: (before, after) => restore(database, before, after),
  }
}

export function updateBalanceAdjustmentUndoableCommand(
  database: Database.Database,
  input: UpdateBalanceAdjustmentInput,
  clock: () => Date,
): UndoableCommand<
  BalanceAdjustmentImage | null,
  BalanceAdjustmentImage | null,
  BalanceAdjustment
> {
  return {
    captureBefore: () => capture(database, input.id),
    execute: () => updateBalanceAdjustment(database, input, clock),
    captureAfter: (result) => capture(database, result.id),
    restoreBefore: (before, after) => restore(database, before, after),
  }
}

export function deleteBalanceAdjustmentUndoableCommand(
  database: Database.Database,
  id: string,
): UndoableCommand<
  BalanceAdjustmentImage | null,
  BalanceAdjustmentImage | null,
  void
> {
  return {
    captureBefore: () => capture(database, id),
    execute: () => deleteBalanceAdjustment(database, id),
    captureAfter: () => null,
    restoreBefore: (before, after) => restore(database, before, after),
  }
}
