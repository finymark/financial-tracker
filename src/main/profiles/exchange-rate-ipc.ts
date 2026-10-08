import type { IpcMain } from 'electron'
import { IPC_CHANNELS, type AppBridge } from '../../shared/ipc'
import { registerIpcHandler } from '../ipc'
import type { ProfileController } from './profile-controller'

export function registerExchangeRateIpc(
  ipcMain: IpcMain,
  controller: ProfileController,
): void {
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.ratesStatus,
    (): Awaited<ReturnType<AppBridge['rates']['status']>> =>
      controller.getActiveApplication().queries.getRateStatus(),
  )
}
