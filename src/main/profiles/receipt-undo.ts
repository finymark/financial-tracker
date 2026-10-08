import type Database from 'better-sqlite3'
import type {
  ConfirmReceiptInput,
  ConfirmedReceipt,
  Receipt,
} from '../../shared/receipts'
import type { UndoableCommand } from './undo-history'
import {
  createTransactionUndoableCommand,
  type TransactionAggregateImage,
} from './transaction-undo'
import {
  getReceipt,
  restoreReceiptState,
  setReceiptDecision,
} from './profile-receipts'

interface ConfirmReceiptImage {
  receipt: Receipt
  transaction: TransactionAggregateImage
}

export function confirmReceiptUndoableCommand(
  database: Database.Database,
  input: ConfirmReceiptInput,
  clock: () => Date,
  attachmentDirectory: string,
): UndoableCommand<ConfirmReceiptImage, ConfirmReceiptImage, ConfirmedReceipt> {
  const receipt = getReceipt(database, input.id)
  const transactionCommand = createTransactionUndoableCommand(
    database,
    {
      ...input.transaction,
      stagedAttachments: [
        {
          originalFileName: receipt.originalFileName,
          storedName: receipt.storedName,
          mediaType: receipt.mediaType,
          byteSize: receipt.byteSize,
        },
      ],
    },
    clock,
    attachmentDirectory,
  )
  return {
    captureBefore: () => ({
      receipt: getReceipt(database, input.id),
      transaction: transactionCommand.captureBefore(),
    }),
    execute: () => {
      const transaction = transactionCommand.execute()
      return {
        transaction,
        receipt: setReceiptDecision(
          database,
          input.id,
          'confirmed',
          transaction.id,
        ),
      }
    },
    captureAfter: (result, before) => ({
      receipt: getReceipt(database, input.id),
      transaction: transactionCommand.captureAfter(
        result.transaction,
        before.transaction,
      ),
    }),
    restoreBefore: (before, after) => {
      transactionCommand.restoreBefore(before.transaction, after.transaction)
      restoreReceiptState(database, before.receipt)
    },
  }
}

export function discardReceiptUndoableCommand(
  database: Database.Database,
  id: string,
): UndoableCommand<Receipt, Receipt, Receipt> {
  return {
    captureBefore: () => getReceipt(database, id),
    execute: () => setReceiptDecision(database, id, 'discarded', null),
    captureAfter: () => getReceipt(database, id),
    restoreBefore: (before) => restoreReceiptState(database, before),
  }
}
