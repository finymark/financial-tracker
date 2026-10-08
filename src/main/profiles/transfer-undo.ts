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

interface StoredFeeImage {
  id: string
  accountId: string
  kind: 'expense'
  excluded: number
  date: string
  totalMinor: number
  payeeId: null
  note: string
  createdAt: string
  updatedAt: string
  lineId: string
  amountMinor: number
  categoryId: string | null
  lineNote?: string
}

interface TransferAggregateImage {
  transfer: StoredTransferImage | null
  fee: StoredFeeImage | null
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
  const hasLineNotes = (
    database.pragma('table_info(transaction_lines)') as { name: string }[]
  ).some((column) => column.name === 'note')
  const fee = transfer?.feeTransactionId
    ? ((database
        .prepare(
          `SELECT transactions.id, transactions.account_id AS accountId,
            transactions.kind, transactions.excluded, transactions.date,
            transactions.total_minor AS totalMinor,
            transactions.payee_id AS payeeId, transactions.note,
            transactions.created_at AS createdAt,
            transactions.updated_at AS updatedAt,
            transaction_lines.id AS lineId,
            transaction_lines.amount_minor AS amountMinor,
            transaction_lines.category_id AS categoryId
            ${hasLineNotes ? ', transaction_lines.note AS lineNote' : ''}
          FROM transactions
          JOIN transaction_lines
            ON transaction_lines.transaction_id = transactions.id
          WHERE transactions.id = ?`,
        )
        .get(transfer.feeTransactionId) as StoredFeeImage | undefined) ?? null)
    : null
  if (transfer?.feeTransactionId && !fee)
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
  const feeIds = new Set(
    [before.fee?.id, after.fee?.id].filter((id): id is string => Boolean(id)),
  )
  for (const feeId of feeIds)
    database.prepare('DELETE FROM transactions WHERE id = ?').run(feeId)
  if (before.fee) {
    const fee = before.fee
    database
      .prepare(
        `INSERT INTO transactions
          (id, account_id, kind, date, total_minor, payee_id, note, excluded,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        fee.id,
        fee.accountId,
        fee.kind,
        fee.date,
        fee.totalMinor,
        fee.payeeId,
        fee.note,
        fee.excluded,
        fee.createdAt,
        fee.updatedAt,
      )
    const hasLineNotes = (
      database.pragma('table_info(transaction_lines)') as { name: string }[]
    ).some((column) => column.name === 'note')
    if (hasLineNotes)
      database
        .prepare(
          `INSERT INTO transaction_lines
            (id, transaction_id, amount_minor, category_id, note)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(fee.lineId, fee.id, fee.amountMinor, fee.categoryId, fee.lineNote)
    else
      database
        .prepare(
          `INSERT INTO transaction_lines
            (id, transaction_id, amount_minor, category_id)
           VALUES (?, ?, ?, ?)`,
        )
        .run(fee.lineId, fee.id, fee.amountMinor, fee.categoryId)
  }
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
