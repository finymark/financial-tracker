import type { BrowserWindow, IpcMain } from 'electron'

import { IPC_CHANNELS } from '../shared/ipc'
import {
  resolvedThemes,
  titleBarOverlay,
  type ResolvedTheme,
} from '../shared/window-chrome'
import { registerIpcHandler } from './ipc'

export function parseResolvedTheme(value: unknown): ResolvedTheme {
  if (
    typeof value !== 'string' ||
    !resolvedThemes.includes(value as ResolvedTheme)
  )
    throw new TypeError('Invalid title bar theme')
  return value as ResolvedTheme
}

export function registerWindowChromeIpc(
  ipcMain: IpcMain,
  windowFromSender: (sender: Electron.WebContents) => BrowserWindow | null,
): void {
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.windowChromeSetTheme,
    (event, value) => {
      const window = windowFromSender(event.sender)
      if (!window || window.isDestroyed())
        throw new Error('IPC sender does not belong to an application window')
      window.setTitleBarOverlay(titleBarOverlay(parseResolvedTheme(value)))
    },
  )
}
