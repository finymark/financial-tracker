import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { openDatabase, pingDatabase } from './db'
import { IPC_CHANNELS, type AppBridge } from '../shared/ipc'
import { ProfileController } from './profiles/profile-controller'
import { registerProfileIpc } from './profiles/profile-ipc'
import { ProfileRegistry } from './profiles/profile-registry'

const APP_ID = 'com.finymark.financial-tracker'
const APP_NAME = 'Financial Tracker'

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
  const database = openDatabase(':memory:')
  const profiles = new ProfileController(
    new ProfileRegistry({ userDataDirectory: app.getPath('userData') }),
  )

  ipcMain.handle(
    IPC_CHANNELS.getVersion,
    (): Awaited<ReturnType<AppBridge['getVersion']>> => app.getVersion(),
  )
  ipcMain.handle(
    IPC_CHANNELS.dbPing,
    (): Awaited<ReturnType<AppBridge['dbPing']>> => pingDatabase(database),
  )
  registerProfileIpc(ipcMain, profiles)

  app.on('will-quit', () => {
    profiles.close()
    database.close()
  })
  createWindow()
})

app.setName(APP_NAME)
app.setAppUserModelId(APP_ID)

app.on('window-all-closed', () => app.quit())
