import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { openDatabase, pingDatabase } from './db'
import { IPC_CHANNELS, type AppBridge } from '../shared/ipc'

function createWindow(): void {
  const window = new BrowserWindow({
    width: 900,
    height: 600,
    title: 'Financial Tracker',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
}

void app.whenReady().then(() => {
  // The scaffold has no profiles or persistent app data yet.
  const database = openDatabase(':memory:')

  ipcMain.handle(
    IPC_CHANNELS.getVersion,
    (): Awaited<ReturnType<AppBridge['getVersion']>> => app.getVersion(),
  )
  ipcMain.handle(
    IPC_CHANNELS.dbPing,
    (): Awaited<ReturnType<AppBridge['dbPing']>> => pingDatabase(database),
  )

  app.on('will-quit', () => database.close())
  createWindow()
})

app.on('window-all-closed', () => app.quit())
