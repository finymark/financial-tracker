import type { IpcMain } from 'electron'
import { IPC_CHANNELS, type AppBridge } from '../../shared/ipc'
import type { ProfileController } from './profile-controller'
import {
  parseTransactionListInput,
  validateTransactionAccountId,
  validateTransactionCategoryId,
  validateTransactionDateShape,
  validateTransactionId,
  validateTransactionKind,
  validateTransactionNote,
  validateTransactionPayeeName,
  validateTransactionTotal,
  validateTransactionExcluded,
} from './transaction-validation'
import { inputRecord, registerIpcHandler } from '../ipc'
import { validateTagNames } from './tag-validation'

function transactionFields(value: unknown) {
  const input = inputRecord(value)
  const lines = (() => {
    if (input.lines === undefined) return undefined
    if (!Array.isArray(input.lines)) throw new Error('transactions.error.lines')
    return input.lines.map((value) => {
      const line = inputRecord(value)
      return {
        amountMinor: validateTransactionTotal(line.amountMinor),
        categoryId: validateTransactionCategoryId(line.categoryId),
        note: validateTransactionNote(line.note),
        tagNames:
          line.tagNames === undefined
            ? undefined
            : validateTagNames(line.tagNames),
      }
    })
  })()
  return {
    accountId: validateTransactionAccountId(input.accountId),
    kind: validateTransactionKind(input.kind),
    date: validateTransactionDateShape(input.date),
    totalMinor: validateTransactionTotal(input.totalMinor),
    payeeName: validateTransactionPayeeName(input.payeeName),
    categoryId: validateTransactionCategoryId(input.categoryId),
    note: validateTransactionNote(input.note),
    tagNames:
      input.tagNames === undefined
        ? undefined
        : validateTagNames(input.tagNames),
    excluded: validateTransactionExcluded(input.excluded),
    lines,
  }
}

export function registerTransactionIpc(
  ipcMain: IpcMain,
  controller: ProfileController,
): void {
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.transactionsList,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['transactions']['list']>> =>
      controller
        .getActiveApplication()
        .queries.listTransactions(parseTransactionListInput(value)),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.payeesList,
    (): Awaited<ReturnType<AppBridge['payees']['list']>> =>
      controller.getActiveApplication().queries.listPayees(),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.transactionsCreate,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['transactions']['create']>> =>
      controller
        .getActiveApplication()
        .commands.createTransaction(transactionFields(value)),
  )
  registerIpcHandler(
    ipcMain,
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
  registerIpcHandler(
    ipcMain,
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
