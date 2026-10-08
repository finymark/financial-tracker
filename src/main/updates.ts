import type { BrowserWindow, IpcMain } from 'electron'
import electronUpdater from 'electron-updater'
import { IPC_CHANNELS } from '../shared/ipc'

const { autoUpdater } = electronUpdater

export function registerUpdates(
  ipcMain: IpcMain,
  window: BrowserWindow,
  packaged: boolean,
  beforeInstall: () => Promise<void>,
): void {
  let ready = false
  let restarting = false

  ipcMain.handle(IPC_CHANNELS.updatesIsReady, () => ready)
  ipcMain.handle(IPC_CHANNELS.updatesRestart, async () => {
    if (!packaged || !ready || restarting) return
    restarting = true
    try {
      // quitAndInstall starts the installer before quitting; close SQLite first.
      await beforeInstall()
      autoUpdater.quitAndInstall(true, true)
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
