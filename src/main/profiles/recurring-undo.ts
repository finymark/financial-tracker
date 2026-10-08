import type Database from 'better-sqlite3'
import type {
  CreateRecurringTransactionInput,
  PendingTransaction,
  RecurringTransaction,
  UpdateRecurringTransactionInput,
} from '../../shared/recurring'
import type { UndoableCommand } from './undo-history'
import {
  createRecurringTransaction,
  deleteRecurringTransaction,
  listPendingTransactions,
  listRecurringTransactions,
  setRecurringPaused,
  storePendingTransaction,
  storeRecurringTransaction,
  updateRecurringTransaction,
} from './profile-recurring'

interface RecurringImage {
  recurring: RecurringTransaction | null
  pending: PendingTransaction[]
}

function capture(
  database: Database.Database,
  id: string | null,
): RecurringImage {
  if (id === null) return { recurring: null, pending: [] }
  const recurring = listRecurringTransactions(database).find(
    (item) => item.id === id,
  )
  return {
    recurring: recurring ?? null,
    pending: listPendingTransactions(database).filter(
      (item) => item.recurringId === id,
    ),
  }
}

function command<Result>(
  database: Database.Database,
  beforeId: string | null,
  execute: () => Result,
  afterId: (result: Result) => string,
): UndoableCommand<RecurringImage, RecurringImage, Result> {
  return {
    captureBefore: () => capture(database, beforeId),
    execute,
    captureAfter: (result) => capture(database, afterId(result)),
    restoreBefore: (before, after) => {
      const id = before.recurring?.id ?? after.recurring?.id
      if (!before.recurring) {
        if (id)
          database
            .prepare('DELETE FROM recurring_transactions WHERE id = ?')
            .run(id)
      } else if (after.recurring) {
        // Editing and pause/resume never mutate existing pending snapshots.
        // A background generation between command and undo must survive.
        storeRecurringTransaction(database, before.recurring)
      } else {
        storeRecurringTransaction(database, before.recurring)
        for (const pending of before.pending)
          storePendingTransaction(database, pending)
      }
    },
  }
}

export const createRecurringUndoableCommand = (
  database: Database.Database,
  input: CreateRecurringTransactionInput,
  clock: () => Date,
) =>
  command(
    database,
    null,
    () => createRecurringTransaction(database, input, clock),
    (item) => item.id,
  )

export const updateRecurringUndoableCommand = (
  database: Database.Database,
  input: UpdateRecurringTransactionInput,
  clock: () => Date,
) =>
  command(
    database,
    input.id,
    () => updateRecurringTransaction(database, input, clock),
    (item) => item.id,
  )

export const pauseRecurringUndoableCommand = (
  database: Database.Database,
  id: string,
  paused: boolean,
  clock: () => Date,
) =>
  command(
    database,
    id,
    () => setRecurringPaused(database, id, paused, clock),
    () => id,
  )

export const deleteRecurringUndoableCommand = (
  database: Database.Database,
  id: string,
) =>
  command(
    database,
    id,
    () => deleteRecurringTransaction(database, id),
    () => id,
  )
