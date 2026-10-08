import type { IpcMain } from 'electron'
import { IPC_CHANNELS, type AppBridge } from '../../shared/ipc'
import { inputRecord, registerIpcHandler } from '../ipc'
import {
  parsePayeeSuggestionInput,
  validatePayeeAliasId,
  validatePayeeAliasName,
  validatePayeeId,
} from './payee-validation'
import type { ProfileController } from './profile-controller'

export function registerPayeeIpc(
  ipcMain: IpcMain,
  controller: ProfileController,
): void {
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.payeesList,
    (): Awaited<ReturnType<AppBridge['payees']['list']>> =>
      controller.getActiveApplication().queries.listPayees(),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.payeesSuggest,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['payees']['suggest']>> =>
      controller
        .getActiveApplication()
        .queries.suggestPayees(parsePayeeSuggestionInput(value)),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.payeeAliasesList,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['payees']['listAliases']>> =>
      controller
        .getActiveApplication()
        .queries.listPayeeAliases(validatePayeeId(inputRecord(value).payeeId)),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.payeeAliasesAdd,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['payees']['addAlias']>> => {
      const input = inputRecord(value)
      return controller.getActiveApplication().commands.addPayeeAlias({
        payeeId: validatePayeeId(input.payeeId),
        name: validatePayeeAliasName(input.name),
      })
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.payeeAliasesRemove,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['payees']['removeAlias']>> => {
      controller
        .getActiveApplication()
        .commands.removePayeeAlias(validatePayeeAliasId(inputRecord(value).id))
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.payeesMerge,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['payees']['merge']>> => {
      const input = inputRecord(value)
      return controller.getActiveApplication().commands.mergePayees({
        sourcePayeeId: validatePayeeId(input.sourcePayeeId),
        survivorPayeeId: validatePayeeId(input.survivorPayeeId),
      })
    },
  )
}
