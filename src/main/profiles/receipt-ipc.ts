import type { IpcMain } from 'electron'
import { IPC_CHANNELS, type AppBridge } from '../../shared/ipc'
import type { ReceiptIntake } from '../../shared/receipts'
import { inputRecord, registerIpcHandler } from '../ipc'
import type { ProfileController } from './profile-controller'
import { validateReceiptId, validateReceiptSource } from './profile-receipts'
import { transactionFields } from './transaction-ipc'

function parseIntake(value: unknown): ReceiptIntake {
  const input = inputRecord(value)
  if (typeof input.path === 'string') {
    if (input.bytes !== undefined || input.name !== undefined)
      throw new Error('receipts.error.path')
    return { path: input.path }
  }
  if (
    !(input.bytes instanceof Uint8Array) ||
    typeof input.name !== 'string' ||
    input.path !== undefined
  )
    throw new Error('receipts.error.path')
  return { bytes: input.bytes, name: input.name }
}

export function registerReceiptIpc(
  ipcMain: IpcMain,
  controller: ProfileController,
): void {
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.receiptsIntake,
    (_event, value): ReturnType<AppBridge['receipts']['intake']> => {
      const input = inputRecord(value)
      return controller
        .getActiveApplication()
        .commands.intakeReceipt(
          parseIntake(input.intake),
          validateReceiptSource(input.source),
        )
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.receiptsList,
    (): Awaited<ReturnType<AppBridge['receipts']['list']>> =>
      controller.getActiveApplication().queries.listReceipts(),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.receiptsCount,
    (): Awaited<ReturnType<AppBridge['receipts']['count']>> =>
      controller.getActiveApplication().queries.getReceiptInboxCount(),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.receiptsDefaultAccount,
    (): Awaited<ReturnType<AppBridge['receipts']['defaultAccountId']>> =>
      controller.getActiveApplication().queries.getReceiptDefaultAccountId(),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.receiptsConfirm,
    (_event, value): Awaited<ReturnType<AppBridge['receipts']['confirm']>> => {
      const input = inputRecord(value)
      return controller.getActiveApplication().commands.confirmReceipt({
        id: validateReceiptId(input.id),
        transaction: transactionFields(input.transaction),
      })
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.receiptsDiscard,
    (_event, value): Awaited<ReturnType<AppBridge['receipts']['discard']>> =>
      controller
        .getActiveApplication()
        .commands.discardReceipt(validateReceiptId(inputRecord(value).id)),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.receiptsPreview,
    (_event, value): ReturnType<AppBridge['receipts']['preview']> => {
      const input = inputRecord(value)
      if (input.thumbnail !== undefined && typeof input.thumbnail !== 'boolean')
        throw new Error('receipts.error.preview')
      return controller
        .getActiveApplication()
        .commands.renderReceiptPreview(
          validateReceiptId(input.id),
          input.thumbnail === true,
        )
    },
  )
}
