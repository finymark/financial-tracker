import type { App, IpcMain } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc'
import type { AutostartStatus, SetAutostartInput } from '../shared/desktop'
import { inputRecord, registerIpcHandler } from './ipc'

export function parseAutostartInput(value: unknown): SetAutostartInput {
  const input = inputRecord(value)
  if (
    typeof input.openAtLogin !== 'boolean' ||
    Object.keys(input).some((key) => key !== 'openAtLogin')
  )
    throw new TypeError('Invalid autostart input')
  return { openAtLogin: input.openAtLogin }
}

export function registerDesktopIpc(
  ipcMain: IpcMain,
  app: App,
  takeQuickAddRequest: () => boolean,
): void {
  const supported = app.isPackaged && process.platform === 'win32'
  const args = ['--hidden']
  const status = (): AutostartStatus => ({
    supported,
    openAtLogin: supported && app.getLoginItemSettings({ args }).openAtLogin,
  })
  registerIpcHandler(ipcMain, IPC_CHANNELS.desktopAutostartStatus, status)
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.desktopSetAutostart,
    (_event, value) => {
      const input = parseAutostartInput(value)
      if (!supported)
        throw new Error('Autostart requires the packaged Windows app')
      app.setLoginItemSettings({ openAtLogin: input.openAtLogin, args })
      const result = status()
      if (result.openAtLogin !== input.openAtLogin)
        throw new Error('Windows did not apply the startup setting')
      return result
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.desktopTakeQuickAddRequest,
    takeQuickAddRequest,
  )
}
