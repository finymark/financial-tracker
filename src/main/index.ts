import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { registerUpdates } from './updates'
import { openDatabase } from './db'
import { IPC_CHANNELS, type AppBridge } from '../shared/ipc'
import { ProfileController } from './profiles/profile-controller'
import { registerCategoryIpc } from './profiles/category-ipc'
import { registerAccountIpc } from './profiles/account-ipc'
import { registerProfileIpc } from './profiles/profile-ipc'
import { registerTransactionIpc } from './profiles/transaction-ipc'
import { registerTransactionCsvIpc } from './profiles/transaction-csv-ipc'
import { registerUndoIpc } from './profiles/undo-ipc'
import { registerTemplateIpc } from './profiles/template-ipc'
import { registerTagIpc } from './profiles/tag-ipc'
import { registerTransferIpc } from './profiles/transfer-ipc'
import { registerPayeeIpc } from './profiles/payee-ipc'
import { registerBalanceAdjustmentIpc } from './profiles/adjustment-ipc'
import { ProfileRegistry } from './profiles/profile-registry'
import { registerIpcHandler } from './ipc'
import { registerCategorisationRuleIpc } from './profiles/rule-ipc'

const APP_ID = 'com.finymark.financial-tracker'
const APP_NAME = 'Financial Tracker'

function createWindow(): BrowserWindow {
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
  return window
}

function smokeTest(): void {
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-smoke-'))
  let exitCode = 1
  try {
    const database = openDatabase(join(directory, 'smoke.sqlite'))
    try {
      const result = database.prepare("SELECT 'ok' AS result").get() as {
        result: string
      }
      if (result.result !== 'ok') throw new Error('SQLite query failed')
      console.log('SQLite smoke test OK')
      exitCode = 0
    } finally {
      database.close()
    }
  } catch {
    console.error('SQLite smoke test FAILED')
  } finally {
    rmSync(directory, { recursive: true, force: true })
    app.exit(exitCode)
  }
}

// Keep the existing dev profile location even when packaging changes app metadata.
app.setName(APP_NAME)
app.setPath('userData', join(app.getPath('appData'), APP_NAME))
app.setAppUserModelId(APP_ID)

void app.whenReady().then(() => {
  if (process.argv.includes('--smoke-test')) {
    smokeTest()
    return
  }
  const profiles = new ProfileController(
    new ProfileRegistry({ userDataDirectory: app.getPath('userData') }),
    app.getLocale(),
  )

  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.getVersion,
    (): Awaited<ReturnType<AppBridge['getVersion']>> => app.getVersion(),
  )
  registerProfileIpc(ipcMain, profiles)
  registerAccountIpc(ipcMain, profiles)
  registerCategoryIpc(ipcMain, profiles)
  registerTransactionIpc(ipcMain, profiles)
  registerTransactionCsvIpc(ipcMain, profiles)
  registerPayeeIpc(ipcMain, profiles)
  registerTransferIpc(ipcMain, profiles)
  registerBalanceAdjustmentIpc(ipcMain, profiles)
  registerUndoIpc(ipcMain, profiles)
  registerTagIpc(ipcMain, profiles)
  registerCategorisationRuleIpc(ipcMain, profiles)
  registerTemplateIpc(ipcMain, profiles)

  let shutdownPromise: Promise<void> | null = null
  let shutdownComplete = false
  function shutdown(): Promise<void> {
    shutdownPromise ??= profiles.shutdown().then(() => {
      shutdownComplete = true
    })
    return shutdownPromise
  }
  app.on('before-quit', (event) => {
    if (shutdownComplete) return
    event.preventDefault()
    void shutdown().then(() => app.quit())
  })
  const window = createWindow()
  registerUpdates(ipcMain, window, app.isPackaged, shutdown, async () => {
    shutdownPromise = null
    shutdownComplete = false
    await profiles.recoverFromFailedShutdown()
  })
})

app.on('window-all-closed', () => app.quit())
