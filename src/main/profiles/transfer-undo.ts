import type Database from 'better-sqlite3'
import type {
  CreateTransferInput,
  Transfer,
  UpdateTransferInput,
} from '../../shared/transfers'
import {
  createTransfer,
  deleteTransfer,
  updateTransfer,
} from './profile-transfers'
import type { UndoableCommand } from './undo-history'
import {
  captureTransactionAggregate,
  restoreTransactionAggregate,
  type TransactionAggregateImage,
} from './transaction-undo'

interface StoredTransferImage {
  id: string
  fromAccountId: string
  fromAmountMinor: number
  toAccountId: string
  toAmountMinor: number
  date: string
  note: string
  feeTransactionId: string | null
  createdAt: string
  updatedAt: string
}

interface TransferAggregateImage {
  transfer: StoredTransferImage | null
  fee: TransactionAggregateImage
}

function captureAggregate(
  database: Database.Database,
  transferId: string | null,
): TransferAggregateImage {
  const transfer = transferId
    ? ((database
        .prepare(
          `SELECT id, from_account_id AS fromAccountId,
            from_amount_minor AS fromAmountMinor,
            to_account_id AS toAccountId, to_amount_minor AS toAmountMinor,
            date, note, fee_transaction_id AS feeTransactionId,
            created_at AS createdAt, updated_at AS updatedAt
          FROM transfers WHERE id = ?`,
        )
        .get(transferId) as StoredTransferImage | undefined) ?? null)
    : null
  const fee = captureTransactionAggregate(
    database,
    transfer?.feeTransactionId ?? null,
  )
  if (transfer?.feeTransactionId && !fee.transaction)
    throw new Error('transfers.error.notFound')
  return { transfer, fee }
}

function restoreAggregate(
  database: Database.Database,
  before: TransferAggregateImage,
  after: TransferAggregateImage,
): void {
  const transferId = before.transfer?.id ?? after.transfer?.id
  if (transferId)
    database.prepare('DELETE FROM transfers WHERE id = ?').run(transferId)
  restoreTransactionAggregate(database, before.fee, after.fee)
  if (before.transfer) {
    const transfer = before.transfer
    database
      .prepare(
        `INSERT INTO transfers
          (id, from_account_id, from_amount_minor, to_account_id,
            to_amount_minor, date, note, fee_transaction_id,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        transfer.id,
        transfer.fromAccountId,
        transfer.fromAmountMinor,
        transfer.toAccountId,
        transfer.toAmountMinor,
        transfer.date,
        transfer.note,
        transfer.feeTransactionId,
        transfer.createdAt,
        transfer.updatedAt,
      )
  }
}

export function createTransferUndoableCommand(
  database: Database.Database,
  input: CreateTransferInput,
  clock: () => Date,
): UndoableCommand<TransferAggregateImage, TransferAggregateImage, Transfer> {
  return {
    captureBefore: () => captureAggregate(database, null),
    execute: () => createTransfer(database, input, clock),
    captureAfter: (result) => captureAggregate(database, result.id),
    restoreBefore: (before, after) => restoreAggregate(database, before, after),
  }
}

export function updateTransferUndoableCommand(
  database: Database.Database,
  input: UpdateTransferInput,
  clock: () => Date,
): UndoableCommand<TransferAggregateImage, TransferAggregateImage, Transfer> {
  return {
    captureBefore: () => captureAggregate(database, input.id),
    execute: () => updateTransfer(database, input, clock),
    captureAfter: (result) => captureAggregate(database, result.id),
    restoreBefore: (before, after) => restoreAggregate(database, before, after),
  }
}

export function deleteTransferUndoableCommand(
  database: Database.Database,
  id: string,
): UndoableCommand<TransferAggregateImage, TransferAggregateImage, void> {
  return {
    captureBefore: () => captureAggregate(database, id),
    execute: () => deleteTransfer(database, id),
    captureAfter: () => captureAggregate(database, null),
    restoreBefore: (before, after) => restoreAggregate(database, before, after),
  }
}
