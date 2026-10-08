import type Database from 'better-sqlite3'
import type {
  CreateRecurringTransactionInput,
  ConfirmPendingTransactionInput,
  PendingTransaction,
  RecurringTransaction,
  UpdateRecurringTransactionInput,
} from '../../shared/recurring'
import type { Transaction } from '../../shared/transactions'
import type { UndoableCommand } from './undo-history'
import {
  confirmPendingTransaction,
  createRecurringTransaction,
  deleteRecurringTransaction,
  generateRecurringTransaction,
  getPendingTransaction,
  getRecurringTransaction,
  listRecurringTransactionOccurrences,
  listRecurringTransactions,
  setRecurringPaused,
  skipPendingTransaction,
  storePendingTransaction,
  storeRecurringTransaction,
  updateRecurringTransaction,
} from './profile-recurring'
import {
  captureTransactionAggregate,
  restoreTransactionAggregate,
  type TransactionAggregateImage,
} from './transaction-undo'
import { findPayeeByName } from './profile-payees'

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
    pending: listRecurringTransactionOccurrences(database, id),
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
        const previousPendingIds = new Set(
          before.pending.map((pending) => pending.id),
        )
        const removeCommandPending = database.prepare(
          "DELETE FROM pending_transactions WHERE id = ? AND status = 'pending'",
        )
        for (const pending of after.pending)
          if (!previousPendingIds.has(pending.id))
            removeCommandPending.run(pending.id)
        // Occurrences generated after the command are absent from its after
        // image and therefore survive undo.
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
    () => {
      const recurring = createRecurringTransaction(database, input, clock)
      generateRecurringTransaction(database, recurring.id, clock)
      return getRecurringTransaction(database, recurring.id)
    },
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
    () => {
      const recurring = updateRecurringTransaction(database, input, clock)
      generateRecurringTransaction(database, recurring.id, clock)
      return getRecurringTransaction(database, recurring.id)
    },
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
    () => {
      if (paused) {
        generateRecurringTransaction(database, id, clock)
        setRecurringPaused(database, id, true, clock)
      } else {
        setRecurringPaused(database, id, false, clock)
        generateRecurringTransaction(database, id, clock)
      }
    },
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

interface PendingDecisionImage {
  pending: PendingTransaction
  transaction: TransactionAggregateImage
}

function restorePendingState(
  database: Database.Database,
  pending: PendingTransaction,
): void {
  database
    .prepare(
      `UPDATE pending_transactions SET status = ?, confirmed_transaction_id = ?
       WHERE id = ?`,
    )
    .run(pending.status, pending.confirmedTransactionId, pending.id)
}

export function confirmPendingUndoableCommand(
  database: Database.Database,
  input: ConfirmPendingTransactionInput,
  clock: () => Date,
): UndoableCommand<PendingDecisionImage, PendingDecisionImage, Transaction> {
  return {
    captureBefore: () => {
      const pending = getPendingTransaction(database, input.id)
      const payee = findPayeeByName(database, pending.payeeName)
      return {
        pending,
        transaction: captureTransactionAggregate(
          database,
          null,
          [payee?.id ?? null],
          pending.tagIds,
        ),
      }
    },
    execute: () => confirmPendingTransaction(database, input, clock),
    captureAfter: (transaction, before) => ({
      pending: getPendingTransaction(database, input.id),
      transaction: captureTransactionAggregate(
        database,
        transaction.id,
        before.transaction.payees.map((payee) => payee.id),
        before.pending.tagIds,
      ),
    }),
    restoreBefore: (before, after) => {
      restoreTransactionAggregate(
        database,
        before.transaction,
        after.transaction,
      )
      restorePendingState(database, before.pending)
    },
  }
}

export function skipPendingUndoableCommand(
  database: Database.Database,
  id: string,
): UndoableCommand<PendingTransaction, PendingTransaction, void> {
  return {
    captureBefore: () => getPendingTransaction(database, id),
    execute: () => skipPendingTransaction(database, id),
    captureAfter: () => getPendingTransaction(database, id),
    restoreBefore: (before) => restorePendingState(database, before),
  }
}
