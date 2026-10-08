import type { IpcMain } from 'electron'
import { IPC_CHANNELS, type AppBridge } from '../../shared/ipc'
import {
  parseListAccountOptionsInput,
  validateAccountCurrency,
  validateAccountId,
  validateAccountName,
  validateOpeningBalance,
  validateOpeningDate,
} from './account-validation'
import type { ProfileController } from './profile-controller'
import { inputRecord, registerIpcHandler } from '../ipc'

export function registerAccountIpc(
  ipcMain: IpcMain,
  controller: ProfileController,
): void {
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.accountsList,
    (): Awaited<ReturnType<AppBridge['accounts']['list']>> =>
      controller.getActiveApplication().queries.listAccounts(),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.accountsListOptions,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['accounts']['listOptions']>> =>
      controller
        .getActiveApplication()
        .queries.listAccountOptions(parseListAccountOptionsInput(value)),
  )
  registerIpcHandler(
    ipcMain,
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
  registerIpcHandler(
    ipcMain,
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
  registerIpcHandler(
    ipcMain,
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
  registerIpcHandler(
    ipcMain,
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
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.accountsUnarchive,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['accounts']['unarchive']>> => {
      const input = inputRecord(value)
      controller
        .getActiveApplication()
        .commands.unarchiveAccount(validateAccountId(input.id))
    },
  )
  registerIpcHandler(
    ipcMain,
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
