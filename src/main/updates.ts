import type { BrowserWindow, IpcMain } from 'electron'
import electronUpdater from 'electron-updater'
import { IPC_CHANNELS } from '../shared/ipc'
import { registerIpcHandler } from './ipc'

const { autoUpdater } = electronUpdater

export function registerUpdates(
  ipcMain: IpcMain,
  window: BrowserWindow,
  packaged: boolean,
  beforeInstall: () => Promise<void>,
  recoverAfterFailure: () => Promise<void> = async () => {},
): void {
  let ready = false
  let restarting = false

  registerIpcHandler(ipcMain, IPC_CHANNELS.updatesIsReady, () => ready)
  registerIpcHandler(ipcMain, IPC_CHANNELS.updatesRestart, async () => {
    if (!packaged || !ready || restarting) return
    restarting = true
    try {
      // quitAndInstall starts the installer before quitting; close SQLite first.
      await beforeInstall()
      try {
        autoUpdater.quitAndInstall(true, true)
      } catch (error) {
        await recoverAfterFailure()
        throw new Error('updates.error', { cause: error })
      }
    } finally {
      restarting = false
    }
  })

  if (!packaged) return
  autoUpdater.autoDownload = true
  // Install only after the profile owner explicitly chooses Restart.
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.on('update-downloaded', () => {
    ready = true
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.updatesReady)
    }
  })
  autoUpdater.on('error', () => {
    console.warn('Update check or installation failed; try again next startup.')
  })
  // Offline/failed checks must not prevent normal startup.
  void autoUpdater.checkForUpdates().catch(() => {})
}
