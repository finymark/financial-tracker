import type { IpcMain } from 'electron'
import { IPC_CHANNELS, type AppBridge } from '../../shared/ipc'
import {
  validateAccountCurrency,
  validateAccountId,
  validateAccountName,
  validateOpeningBalance,
  validateOpeningDate,
} from './account-validation'
import type { ProfileController } from './profile-controller'

function inputRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('IPC input must be an object')
  }
  return value as Record<string, unknown>
}

export function registerAccountIpc(
  ipcMain: IpcMain,
  controller: ProfileController,
): void {
  ipcMain.handle(
    IPC_CHANNELS.accountsList,
    (): Awaited<ReturnType<AppBridge['accounts']['list']>> =>
      controller.getActiveApplication().queries.listAccounts(),
  )
  ipcMain.handle(
    IPC_CHANNELS.accountsListOptions,
    (): Awaited<ReturnType<AppBridge['accounts']['listOptions']>> =>
      controller.getActiveApplication().queries.listAccountOptions(),
  )
  ipcMain.handle(
    IPC_CHANNELS.accountsCreate,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['accounts']['create']>> => {
      const input = inputRecord(value)
      return controller.getActiveApplication().commands.createAccount({
        name: validateAccountName(input.name),
        currency: validateAccountCurrency(input.currency),
        openingBalance: validateOpeningBalance(input.openingBalance),
        openingDate: validateOpeningDate(input.openingDate),
      })
    },
  )
  ipcMain.handle(
    IPC_CHANNELS.accountsRename,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['accounts']['rename']>> => {
      const input = inputRecord(value)
      return controller.getActiveApplication().commands.renameAccount({
        id: validateAccountId(input.id),
        name: validateAccountName(input.name),
      })
    },
  )
  ipcMain.handle(
    IPC_CHANNELS.accountsChangeCurrency,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['accounts']['changeCurrency']>> => {
      const input = inputRecord(value)
      return controller.getActiveApplication().commands.changeAccountCurrency({
        id: validateAccountId(input.id),
        currency: validateAccountCurrency(input.currency),
      })
    },
  )
  ipcMain.handle(
    IPC_CHANNELS.accountsArchive,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['accounts']['archive']>> => {
      const input = inputRecord(value)
      controller
        .getActiveApplication()
        .commands.archiveAccount(validateAccountId(input.id))
    },
  )
  ipcMain.handle(
    IPC_CHANNELS.accountsDelete,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['accounts']['delete']>> => {
      const input = inputRecord(value)
      controller
        .getActiveApplication()
        .commands.deleteAccount(validateAccountId(input.id))
    },
  )
}
