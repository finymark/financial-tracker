import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  Tray,
} from 'electron'
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
import { registerExchangeRateIpc } from './profiles/exchange-rate-ipc'
import {
  createElectronNetTransport,
  MnbExchangeRateSource,
} from './exchange-rates/mnb-source'
import { ExchangeRateScheduler } from './exchange-rates/exchange-rate-scheduler'
import { registerReportIpc } from './profiles/report-ipc'
import { RecurringScheduler } from './recurring-scheduler'
import { registerRecurringIpc } from './profiles/recurring-ipc'
import { AppSettingsFile } from './app-settings'
import { registerDesktopIpc } from './desktop-ipc'
import { buildTrayMenu, trayLanguage } from './tray-menu'
import { desktopMessages } from '../shared/desktop-translations'
import { startsHidden } from '../shared/desktop'

let mainWindow: BrowserWindow | null = null
let quitting = false
let quickAddRequested = false
let pendingSecondLaunch = false

function showMainWindow(): void {
  if (quitting || !mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

// #81 replaces this entry point with the standalone quick-add window.
export function openQuickAdd(): void {
  if (quitting) return
  showMainWindow()
  quickAddRequested = true
  mainWindow?.webContents.send(IPC_CHANNELS.desktopQuickAdd)
}

const APP_ID = 'com.finymark.financial-tracker'
const APP_NAME = 'Financial Tracker'

function createWindow(hidden: boolean): BrowserWindow {
  const window = new BrowserWindow({
    show: false,
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

  window.once('ready-to-show', () => {
    if ((!hidden || pendingSecondLaunch) && !quitting) showMainWindow()
    pendingSecondLaunch = false
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

// Smoke tests must be independent of the UI instance, tray, and shutdown hooks.
const isSmokeTest = process.argv.includes('--smoke-test')
const ownsInstance = isSmokeTest || app.requestSingleInstanceLock()
if (!ownsInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    pendingSecondLaunch = true
    showMainWindow()
  })
  void app.whenReady().then(startApplication)
}

function startApplication(): void {
  if (isSmokeTest) {
    smokeTest()
    return
  }
  const settings = new AppSettingsFile(app.getPath('userData'))
  let trayNoticeShown = settings.isTrayNoticeShown()
  let tray: Tray | null = null
  const rateSource = new MnbExchangeRateSource(createElectronNetTransport())
  const onRateStatusChanged = () => {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send(IPC_CHANNELS.ratesStatusChanged)
  }
  const onPendingTransactionsChanged = () => {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send(IPC_CHANNELS.pendingChanged)
  }
  const profiles = new ProfileController(
    new ProfileRegistry({ userDataDirectory: app.getPath('userData') }),
    app.getLocale(),
    {
      exchangeRateSource: rateSource,
      onRateStatusChanged,
      onPendingTransactionsChanged,
    },
  )
  const exchangeRates = new ExchangeRateScheduler(profiles, rateSource, {
    onStatusChanged: onRateStatusChanged,
  })
  exchangeRates.start()
  const recurring = new RecurringScheduler(profiles)
  recurring.start()

  const activeLanguage = () =>
    trayLanguage(profiles.getActive()?.settings.language, app.getLocale())
  const updateTray = () => {
    if (!tray || tray.isDestroyed()) return
    const language = activeLanguage()
    tray.setToolTip(desktopMessages[language]['tray.tooltip'])
    tray.setContextMenu(
      Menu.buildFromTemplate(
        buildTrayMenu(language, {
          open: showMainWindow,
          quickAdd: openQuickAdd,
          quit: () => app.quit(),
        }),
      ),
    )
  }
  registerDesktopIpc(ipcMain, app, () => {
    const requested = quickAddRequested
    quickAddRequested = false
    return requested
  })

  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.getVersion,
    (): Awaited<ReturnType<AppBridge['getVersion']>> => app.getVersion(),
  )
  registerProfileIpc(
    ipcMain,
    profiles,
    () => {
      exchangeRates.start()
      void exchangeRates.refreshActive()
      recurring.start()
    },
    () => {
      exchangeRates.stop()
      recurring.stop()
    },
    updateTray,
  )
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
  registerExchangeRateIpc(ipcMain, profiles)
  registerReportIpc(ipcMain, profiles)
  registerRecurringIpc(ipcMain, profiles)

  let shutdownPromise: Promise<void> | null = null
  let shutdownComplete = false
  function shutdown(): Promise<void> {
    exchangeRates.stop()
    recurring.stop()
    shutdownPromise ??= profiles.shutdown().then(() => {
      shutdownComplete = true
    })
    return shutdownPromise
  }
  app.on('before-quit', (event) => {
    quitting = true
    if (shutdownComplete) return
    event.preventDefault()
    void shutdown().then(() => app.quit())
  })
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(app.getAppPath(), 'build/icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  if (icon.isEmpty())
    throw new Error('Application tray icon could not be loaded')
  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.on('click', showMainWindow)
  tray.on('double-click', showMainWindow)
  updateTray()
  app.on('will-quit', () => tray?.destroy())

  mainWindow = createWindow(startsHidden(process.argv))
  mainWindow.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    mainWindow?.hide()
    if (!trayNoticeShown) {
      trayNoticeShown = true
      // Native notice, not a Windows toast. No profile data is included.
      const messages = desktopMessages[activeLanguage()]
      void dialog
        .showMessageBox({
          type: 'info',
          title: APP_NAME,
          message: messages['tray.notice'],
          buttons: [messages['tray.noticeOk']],
        })
        .catch(() => {
          console.warn('Could not show the tray notice.')
        })
      try {
        settings.markTrayNoticeShown()
      } catch {
        console.warn('Could not persist the tray notice flag.')
      }
    }
  })
  // Windows may end the session without emitting before-quit. Never veto it.
  mainWindow.on('session-end', () => {
    quitting = true
    void shutdown()
  })
  registerUpdates(
    ipcMain,
    mainWindow,
    app.isPackaged,
    () => {
      // electron-updater can close windows before Electron's before-quit event.
      quitting = true
      return shutdown()
    },
    async () => {
      quitting = false
      shutdownPromise = null
      shutdownComplete = false
      await profiles.recoverFromFailedShutdown()
      exchangeRates.start()
      void exchangeRates.refreshActive()
      recurring.start()
      updateTray()
    },
  )
}
