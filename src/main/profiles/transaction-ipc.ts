import type { IpcMain } from 'electron'
import { IPC_CHANNELS, type AppBridge } from '../../shared/ipc'
import type { ProfileController } from './profile-controller'
import {
  parseTransactionListInput,
  validateTransactionAccountId,
  validateTransactionCategoryId,
  validateTransactionDate,
  validateTransactionId,
  validateTransactionKind,
  validateTransactionNote,
  validateTransactionPayeeName,
  validateTransactionTotal,
} from './transaction-validation'

function inputRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('IPC input must be an object')
  }
  return value as Record<string, unknown>
}

function transactionFields(value: unknown) {
  const input = inputRecord(value)
  return {
    accountId: validateTransactionAccountId(input.accountId),
    kind: validateTransactionKind(input.kind),
    date: validateTransactionDate(input.date, () => new Date()),
    totalMinor: validateTransactionTotal(input.totalMinor),
    payeeName: validateTransactionPayeeName(input.payeeName),
    categoryId: validateTransactionCategoryId(input.categoryId),
    note: validateTransactionNote(input.note),
  }
}

export function registerTransactionIpc(
  ipcMain: IpcMain,
  controller: ProfileController,
): void {
  ipcMain.handle(
    IPC_CHANNELS.transactionsList,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['transactions']['list']>> =>
      controller
        .getActiveApplication()
        .queries.listTransactions(parseTransactionListInput(value)),
  )
  ipcMain.handle(
    IPC_CHANNELS.payeesList,
    (): Awaited<ReturnType<AppBridge['payees']['list']>> =>
      controller.getActiveApplication().queries.listPayees(),
  )
  ipcMain.handle(
    IPC_CHANNELS.transactionsCreate,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['transactions']['create']>> =>
      controller
        .getActiveApplication()
        .commands.createTransaction(transactionFields(value)),
  )
  ipcMain.handle(
    IPC_CHANNELS.transactionsUpdate,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['transactions']['update']>> => {
      const input = inputRecord(value)
      return controller.getActiveApplication().commands.updateTransaction({
        id: validateTransactionId(input.id),
        ...transactionFields(input),
      })
    },
  )
  ipcMain.handle(
    IPC_CHANNELS.transactionsDelete,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['transactions']['delete']>> => {
      controller
        .getActiveApplication()
        .commands.deleteTransaction(
          validateTransactionId(inputRecord(value).id),
        )
    },
  )
}
