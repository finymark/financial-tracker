import type { IpcMain } from 'electron'
import { IPC_CHANNELS, type AppBridge } from '../../shared/ipc'
import { inputRecord, registerIpcHandler } from '../ipc'
import type { ProfileController } from './profile-controller'
import { recurringFields, validateRecurringId } from './recurring-validation'

export function registerRecurringIpc(
  ipcMain: IpcMain,
  controller: ProfileController,
): void {
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.recurringList,
    (): Awaited<ReturnType<AppBridge['recurring']['list']>> =>
      controller.getActiveApplication().queries.listRecurringTransactions(),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.recurringCreate,
    (_event, value): Awaited<ReturnType<AppBridge['recurring']['create']>> =>
      controller
        .getActiveApplication()
        .commands.createRecurringTransaction(
          recurringFields(inputRecord(value)),
        ),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.recurringUpdate,
    (_event, value): Awaited<ReturnType<AppBridge['recurring']['update']>> => {
      const input = inputRecord(value)
      return controller
        .getActiveApplication()
        .commands.updateRecurringTransaction({
          id: validateRecurringId(input.id),
          ...recurringFields(input),
        })
    },
  )
  for (const [channel, command] of [
    [IPC_CHANNELS.recurringPause, 'pauseRecurringTransaction'],
    [IPC_CHANNELS.recurringResume, 'resumeRecurringTransaction'],
    [IPC_CHANNELS.recurringDelete, 'deleteRecurringTransaction'],
  ] as const) {
    registerIpcHandler(ipcMain, channel, (_event, value): void => {
      controller
        .getActiveApplication()
        .commands[command](validateRecurringId(inputRecord(value).id))
    })
  }
}
