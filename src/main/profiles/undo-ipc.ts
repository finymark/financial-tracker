import type { IpcMain } from 'electron'
import { IPC_CHANNELS, type AppBridge } from '../../shared/ipc'
import { registerIpcHandler } from '../ipc'
import type { ProfileController } from './profile-controller'

export function registerUndoIpc(
  ipcMain: IpcMain,
  controller: ProfileController,
): void {
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.undoLast,
    (): Awaited<ReturnType<AppBridge['undo']['last']>> =>
      controller.getActiveApplication().commands.undoLast(),
  )
}
