import type { IpcMain } from 'electron'
import { IPC_CHANNELS, type AppBridge } from '../../shared/ipc'
import { inputRecord, registerIpcHandler } from '../ipc'
import type { ProfileController } from './profile-controller'
import {
  validateTransactionAccountId,
  validateTransactionCategoryId,
  validateTransactionDateShape,
  validateTransactionId,
  validateTransactionNote,
  validateTransactionTotal,
  validateTransactionExcluded,
} from './transaction-validation'

function transferFields(value: unknown) {
  const input = inputRecord(value)
  let fee = null
  if (input.fee !== null && input.fee !== undefined) {
    const feeInput = inputRecord(input.fee)
    fee = {
      amountMinor: validateTransactionTotal(feeInput.amountMinor),
      excluded: validateTransactionExcluded(feeInput.excluded),
      ...(feeInput.categoryId === undefined
        ? {}
        : {
            categoryId: validateTransactionCategoryId(feeInput.categoryId),
          }),
    }
  }
  return {
    fromAccountId: validateTransactionAccountId(input.fromAccountId),
    fromAmountMinor: validateTransactionTotal(input.fromAmountMinor),
    toAccountId: validateTransactionAccountId(input.toAccountId),
    toAmountMinor: validateTransactionTotal(input.toAmountMinor),
    date: validateTransactionDateShape(input.date),
    note: validateTransactionNote(input.note),
    fee,
  }
}

export function registerTransferIpc(
  ipcMain: IpcMain,
  controller: ProfileController,
): void {
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.transfersCreate,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['transfers']['create']>> =>
      controller
        .getActiveApplication()
        .commands.createTransfer(transferFields(value)),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.transfersUpdate,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['transfers']['update']>> => {
      const input = inputRecord(value)
      return controller.getActiveApplication().commands.updateTransfer({
        id: validateTransactionId(input.id),
        ...transferFields(input),
      })
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.transfersDelete,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['transfers']['delete']>> => {
      controller
        .getActiveApplication()
        .commands.deleteTransfer(validateTransactionId(inputRecord(value).id))
    },
  )
}
