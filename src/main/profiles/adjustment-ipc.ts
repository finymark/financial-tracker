import type { IpcMain } from 'electron'
import { IPC_CHANNELS, type AppBridge } from '../../shared/ipc'
import { inputRecord, registerIpcHandler } from '../ipc'
import type { ProfileController } from './profile-controller'
import {
  validateBalanceAdjustmentAccountId,
  validateBalanceAdjustmentDateShape,
  validateBalanceAdjustmentId,
  validateBalanceAdjustmentNote,
  validateObservedBalance,
} from './adjustment-validation'

function adjustmentFields(value: unknown) {
  const input = inputRecord(value)
  return {
    accountId: validateBalanceAdjustmentAccountId(input.accountId),
    date: validateBalanceAdjustmentDateShape(input.date),
    observedMinor: validateObservedBalance(input.observedMinor),
    note: validateBalanceAdjustmentNote(input.note),
  }
}

export function registerBalanceAdjustmentIpc(
  ipcMain: IpcMain,
  controller: ProfileController,
): void {
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.adjustmentsCreate,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['adjustments']['create']>> =>
      controller
        .getActiveApplication()
        .commands.createBalanceAdjustment(adjustmentFields(value)),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.adjustmentsUpdate,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['adjustments']['update']>> => {
      const input = inputRecord(value)
      return controller
        .getActiveApplication()
        .commands.updateBalanceAdjustment({
          id: validateBalanceAdjustmentId(input.id),
          ...adjustmentFields(input),
        })
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.adjustmentsDelete,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['adjustments']['delete']>> => {
      controller
        .getActiveApplication()
        .commands.deleteBalanceAdjustment(
          validateBalanceAdjustmentId(inputRecord(value).id),
        )
    },
  )
}
