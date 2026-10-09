import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  Notification,
  screen,
  Tray,
  type BrowserWindowConstructorOptions,
} from 'electron'
import electronUpdater from 'electron-updater'
import { join } from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { registerUpdates, type UpdaterLike } from './updates'
import { LastVersionFile } from './last-version'
import { openDatabase } from './db'
import { IPC_CHANNELS, type AppBridge } from '../shared/ipc'
import { ProfileController } from './profiles/profile-controller'
import type {
  WatchedFolderFailure,
  WatchedFolderStatus,
} from '../shared/settings'
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
import { configureTrustedIpcWebContents, registerIpcHandler } from './ipc'
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
import { WindowStateFile } from './window-state-file'
import { WindowStateTracker, type WindowState } from './window-state'
import { registerDesktopIpc } from './desktop-ipc'
import { buildTrayMenu, trayLanguage } from './tray-menu'
import { desktopMessages } from '../shared/desktop-translations'
import { startsHidden } from '../shared/desktop'
import { QuickAddShortcut } from './global-shortcut'
import { registerAttachmentIpc } from './profiles/attachment-ipc'
import { registerReceiptIpc } from './profiles/receipt-ipc'
import { registerPhoneUploadIpc, renderPhoneUploadQr } from './phone-upload-ipc'
import sharp from 'sharp'
import { preprocessReceiptImage } from './ocr/receipt-preprocessing'
import { TesseractOcrEngine } from './ocr/tesseract-ocr-engine'
import { titleBarOverlay } from '../shared/window-chrome'
import { registerWindowChromeIpc } from './window-chrome'
import {
  blocksPackagedShortcut,
  developmentWindowCommand,
  nextZoomLevel,
  zoomCommand,
} from './window-shortcuts'

let mainWindow: BrowserWindow | null = null
let quickAddWindow: BrowserWindow | null = null
let quitting = false
let pendingSecondLaunch = false
let windowStateTracker: WindowStateTracker | null = null
let openQuickAddImplementation: () => Promise<void> = async () => {}

function showMainWindow(): void {
  if (quitting || !mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  const window = mainWindow
  windowStateTracker?.showFirstTime((state) => {
    window.setBounds(state.bounds)
    // On Windows maximize() also shows a hidden window. Do it only on request.
    if (state.maximized) window.maximize()
  })
  mainWindow.show()
  mainWindow.focus()
}

export function openQuickAdd(): void {
  if (quitting) return
  void openQuickAddImplementation()
}

const APP_ID = 'com.finymark.financial-tracker'
const APP_NAME = 'Financial Tracker'

function applicationIconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.ico')
    : join(app.getAppPath(), 'build/icon.ico')
}

function createAppWindow(
  options: Omit<BrowserWindowConstructorOptions, 'webPreferences'>,
  view?: 'quick-add',
): BrowserWindow {
  const window = new BrowserWindow({
    icon: applicationIconPath(),
    ...options,
    titleBarStyle: 'hidden',
    titleBarOverlay: titleBarOverlay(
      nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
    ),
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  window.removeMenu()
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.on('before-input-event', (event, input) => {
    if (app.isPackaged && blocksPackagedShortcut(input)) {
      event.preventDefault()
      return
    }
    if (!app.isPackaged) {
      const developmentCommand = developmentWindowCommand(input)
      if (developmentCommand) {
        event.preventDefault()
        if (developmentCommand === 'reload') window.webContents.reload()
        else window.webContents.toggleDevTools()
        return
      }
    }
    const command = zoomCommand(input)
    if (!command) return
    event.preventDefault()
    window.webContents.setZoomLevel(
      nextZoomLevel(window.webContents.getZoomLevel(), command),
    )
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL)
    if (view) url.searchParams.set('view', view)
    void window.loadURL(url.href)
  } else {
    void window.loadFile(join(import.meta.dirname, '../renderer/index.html'), {
      ...(view ? { query: { view } } : {}),
    })
  }
  return window
}

function createWindow(hidden: boolean, state: WindowState): BrowserWindow {
  const window = createAppWindow({
    show: false,
    ...state.bounds,
    title: 'Financial Tracker',
  })

  window.once('ready-to-show', () => {
    if ((!hidden || pendingSecondLaunch) && !quitting) showMainWindow()
    pendingSecondLaunch = false
  })
  return window
}

function positionOnActiveDisplay(window: BrowserWindow): void {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const bounds = window.getBounds()
  window.setPosition(
    Math.round(
      display.workArea.x + (display.workArea.width - bounds.width) / 2,
    ),
    Math.round(
      display.workArea.y + (display.workArea.height - bounds.height) / 2,
    ),
  )
}

function createQuickAddWindow(): BrowserWindow {
  const window = createAppWindow(
    {
      show: false,
      width: 560,
      height: 720,
      minWidth: 460,
      minHeight: 560,
      title: 'Financial Tracker — Quick add',
      alwaysOnTop: true,
      autoHideMenuBar: true,
    },
    'quick-add',
  )
  window.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    window.hide()
  })
  window.on('closed', () => {
    if (quickAddWindow === window) quickAddWindow = null
  })
  return window
}

function showQuickAddWindow(created: boolean): void {
  const window = quickAddWindow
  if (!window || window.isDestroyed() || quitting) return
  const show = () => {
    if (quitting || window.isDestroyed()) return
    positionOnActiveDisplay(window)
    window.show()
    window.focus()
  }
  if (created || window.webContents.isLoadingMainFrame()) {
    window.once('ready-to-show', show)
  } else {
    window.webContents.once('did-finish-load', show)
    window.webContents.reload()
  }
}

async function smokeTest(): Promise<void> {
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
    } finally {
      database.close()
    }
    const image = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255])
    const processed = await sharp(image, {
      raw: { width: 2, height: 2, channels: 3 },
    })
      .resize(1, 1)
      .png()
      .toBuffer()
    const metadata = await sharp(processed).metadata()
    if (metadata.width !== 1 || metadata.height !== 1)
      throw new Error('Image processing failed')
    console.log('Image smoke test OK')
    const syntheticReceipt = await sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="160">
          <rect width="100%" height="100%" fill="white"/>
          <text x="35" y="110" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="black">TOTAL 12.50</text>
        </svg>`,
      ),
    )
      .png()
      .toBuffer()
    const ocr = new TesseractOcrEngine()
    try {
      const result = await ocr.recognize(
        await preprocessReceiptImage(syntheticReceipt),
        ['eng'],
      )
      if (!/TOTAL\s+12[.,]50/iu.test(result.text))
        throw new Error(`OCR returned unexpected text: ${result.text}`)
      console.log('OCR smoke test OK')
    } finally {
      await ocr.dispose()
    }
    const qrDataUrl = await renderPhoneUploadQr(
      `http://192.168.1.2:12345/u/${'a'.repeat(43)}`,
    )
    if (!qrDataUrl.startsWith('data:image/png;base64,'))
      throw new Error('QR rendering failed')
    console.log('QR smoke test OK')
    exitCode = 0
  } catch (error) {
    console.error('Smoke test FAILED', error)
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
  app.on('second-instance', (_event, commandLine) => {
    if (startsHidden(commandLine)) return
    pendingSecondLaunch = true
    showMainWindow()
  })
  void app
    .whenReady()
    .then(startApplication)
    .catch((error: unknown) => {
      console.error('Application startup failed', error)
      const detail =
        error instanceof Error ? error.message : 'An unknown error occurred.'
      try {
        dialog.showErrorBox(
          APP_NAME,
          `Financial Tracker could not start.\n\n${detail}`,
        )
      } finally {
        app.exit(1)
      }
    })
}

function startApplication(): void {
  if (isSmokeTest) {
    void smokeTest()
    return
  }
  Menu.setApplicationMenu(null)
  let settings: AppSettingsFile
  try {
    settings = new AppSettingsFile(app.getPath('userData'))
  } catch (error) {
    throw new Error('Could not read or create app-settings.json.', {
      cause: error,
    })
  }
  const justUpdatedVersion = app.isPackaged
    ? new LastVersionFile(app.getPath('userData')).recordCurrentVersion(
        app.getVersion(),
      )
    : null
  let trayNoticeShown = settings.isTrayNoticeShown()
  let tray: Tray | null = null
  const windowStateFile = new WindowStateFile(app.getPath('userData'))
  const tracker = new WindowStateTracker({
    savedState: windowStateFile.getWindowState(),
    getDisplays: () => ({
      workAreas: screen.getAllDisplays().map((display) => display.workArea),
      primaryWorkArea: screen.getPrimaryDisplay().workArea,
    }),
    getSnapshot: () => {
      if (!mainWindow || mainWindow.isDestroyed()) return undefined
      return {
        bounds: mainWindow.getBounds(),
        normalBounds: mainWindow.getNormalBounds(),
        maximized: mainWindow.isMaximized(),
        minimized: mainWindow.isMinimized(),
        fullscreen: mainWindow.isFullScreen(),
      }
    },
    save: (state) => {
      try {
        windowStateFile.setWindowState(state)
      } catch {
        console.warn('Could not persist the main window state.')
      }
    },
  })
  windowStateTracker = tracker
  const rateSource = new MnbExchangeRateSource(createElectronNetTransport())
  const receiptOcr = new TesseractOcrEngine()
  const onRateStatusChanged = () => {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send(IPC_CHANNELS.ratesStatusChanged)
  }
  const onPendingTransactionsChanged = () => {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send(IPC_CHANNELS.pendingChanged)
  }
  const onReceiptInboxChanged = () => {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send(IPC_CHANNELS.receiptsChanged)
  }
  const onWatchedFolderStatusChanged = (status: WatchedFolderStatus | null) => {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send(
        IPC_CHANNELS.profilesWatchedFolderStatusChanged,
        status,
      )
  }
  const onWatchedFolderFailure = (failure: WatchedFolderFailure) => {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send(
        IPC_CHANNELS.profilesWatchedFolderFailure,
        failure,
      )
  }
  const profiles = new ProfileController(
    new ProfileRegistry({ userDataDirectory: app.getPath('userData') }),
    app.getLocale(),
    {
      exchangeRateSource: rateSource,
      onRateStatusChanged,
      onPendingTransactionsChanged,
      onReceiptInboxChanged,
      onWatchedFolderStatusChanged,
      onWatchedFolderFailure,
      ocrEngine: receiptOcr,
    },
  )
  const exchangeRates = new ExchangeRateScheduler(profiles, rateSource, {
    onStatusChanged: onRateStatusChanged,
  })
  exchangeRates.start()
  const recurring = new RecurringScheduler(profiles)
  recurring.start()

  configureTrustedIpcWebContents(() =>
    [mainWindow, quickAddWindow]
      .filter((window): window is BrowserWindow =>
        Boolean(window && !window.isDestroyed()),
      )
      .map((window) => window.webContents),
  )
  registerWindowChromeIpc(ipcMain, (contents) =>
    BrowserWindow.fromWebContents(contents),
  )

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

  const profileOpenedOutsideMainRenderer = () => {
    exchangeRates.start()
    void exchangeRates.refreshActive()
    recurring.start()
    updateTray()
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send(IPC_CHANNELS.desktopProfileChanged)
    if (quickAddWindow && !quickAddWindow.isDestroyed())
      quickAddWindow.webContents.send(IPC_CHANNELS.desktopProfileChanged)
  }
  let openingQuickAdd = false
  openQuickAddImplementation = async () => {
    if (openingQuickAdd || quitting) return
    if (
      quickAddWindow &&
      !quickAddWindow.isDestroyed() &&
      quickAddWindow.isVisible()
    ) {
      quickAddWindow.focus()
      return
    }
    openingQuickAdd = true
    try {
      const hadActiveProfile = profiles.getActive() !== null
      const opened = await profiles.openLastUsed()
      if (!hadActiveProfile && opened) profileOpenedOutsideMainRenderer()
      const created = !quickAddWindow || quickAddWindow.isDestroyed()
      if (created) quickAddWindow = createQuickAddWindow()
      showQuickAddWindow(created)
    } catch (error) {
      console.error('Could not open quick add.', error)
      void dialog
        .showMessageBox({
          type: 'error',
          title: APP_NAME,
          message: desktopMessages[activeLanguage()]['quickAdd.openError'],
        })
        .catch(() => {
          console.warn('Could not show the quick-add error.')
        })
      showMainWindow()
    } finally {
      openingQuickAdd = false
    }
  }

  const quickAddShortcut = new QuickAddShortcut(
    globalShortcut,
    settings,
    openQuickAdd,
  )
  quickAddShortcut.start()
  const disposeDesktopIntegrations = () => {
    quickAddShortcut.dispose()
    if (tray && !tray.isDestroyed()) tray.destroy()
  }

  registerDesktopIpc(ipcMain, app, {
    shortcutStatus: () => quickAddShortcut.status(),
    setShortcut: (accelerator) => quickAddShortcut.set(accelerator),
    showMain: showMainWindow,
    closeQuickAdd: () => quickAddWindow?.hide(),
    quickAddSaved: () => {
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send(
          IPC_CHANNELS.desktopDataChanged,
          mainWindow.isVisible(),
        )
    },
  })

  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.getVersion,
    (): Awaited<ReturnType<AppBridge['getVersion']>> => app.getVersion(),
  )
  const phoneUpload = registerPhoneUploadIpc(ipcMain, {
    getActiveProfile: () => {
      const active = profiles.getActive()
      if (!active) throw new Error('No profile is open')
      const application = profiles.getActiveApplication()
      return {
        id: active.id,
        language: active.settings.language,
        intake: (input, source) =>
          application.commands.intakeReceipt(
            { bytes: input.bytes, name: input.name },
            source,
          ),
      }
    },
    onReceived: (received) => {
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send(IPC_CHANNELS.phoneUploadReceived, received)
    },
  })
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
    () => {
      updateTray()
      if (quickAddWindow && !quickAddWindow.isDestroyed())
        quickAddWindow.webContents.send(IPC_CHANNELS.desktopProfileChanged)
    },
    () => phoneUpload.stop(),
  )
  registerAccountIpc(ipcMain, profiles)
  registerCategoryIpc(ipcMain, profiles)
  registerTransactionIpc(ipcMain, profiles)
  const disposeAttachmentIpc = registerAttachmentIpc(ipcMain, profiles)
  registerReceiptIpc(ipcMain, profiles)
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
    tracker.flush()
    exchangeRates.stop()
    recurring.stop()
    shutdownPromise ??= phoneUpload
      .stop()
      .then(() => profiles.shutdown())
      .then(() => {
        shutdownComplete = true
      })
    return shutdownPromise
  }
  app.on('before-quit', (event) => {
    quitting = true
    if (shutdownComplete) return
    event.preventDefault()
    void shutdown().then(
      () => app.quit(),
      (error: unknown) => {
        console.error('Application shutdown failed', error)
        shutdownPromise = null
        disposeDesktopIntegrations()
        app.exit(1)
      },
    )
  })
  const iconPath = applicationIconPath()
  const icon = nativeImage.createFromPath(iconPath)
  if (icon.isEmpty())
    throw new Error('Application tray icon could not be loaded')
  // Pass the ICO path so Windows can select the best frame for the current DPI.
  tray = new Tray(iconPath)
  tray.on('click', showMainWindow)
  tray.on('double-click', showMainWindow)
  updateTray()
  app.on('will-quit', () => {
    void receiptOcr.dispose()
    disposeAttachmentIpc()
    disposeDesktopIntegrations()
  })

  mainWindow = createWindow(startsHidden(process.argv), tracker.initialState())
  const onWindowStateChanged = () => {
    if (!quitting) tracker.changed()
  }
  mainWindow.on('resize', onWindowStateChanged)
  mainWindow.on('move', onWindowStateChanged)
  mainWindow.on('maximize', onWindowStateChanged)
  mainWindow.on('unmaximize', onWindowStateChanged)
  mainWindow.on('close', (event) => {
    if (quitting) return
    tracker.flush()
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
  const updateWindow = mainWindow
  const { autoUpdater } = electronUpdater
  registerUpdates({
    ipcMain,
    updater: autoUpdater as UpdaterLike,
    packaged: app.isPackaged,
    justUpdatedVersion,
    beforeInstall: () => {
      // electron-updater can close windows before Electron's before-quit event.
      quitting = true
      return shutdown()
    },
    recoverAfterFailure: async () => {
      quitting = false
      shutdownPromise = null
      shutdownComplete = false
      await profiles.recoverFromFailedShutdown()
      exchangeRates.start()
      void exchangeRates.refreshActive()
      recurring.start()
      updateTray()
    },
    window: {
      send: (state) => {
        if (!updateWindow.isDestroyed())
          updateWindow.webContents.send(IPC_CHANNELS.updatesStateChanged, state)
      },
      isVisible: () => !updateWindow.isDestroyed() && updateWindow.isVisible(),
      show: showMainWindow,
    },
    notifications: {
      show: (version, onClick) => {
        const messages = desktopMessages[activeLanguage()]
        const notification = new Notification({
          title: messages['updates.readyTitle'],
          body: messages['updates.readyBody'].replace('{version}', version),
        })
        notification.once('click', onClick)
        notification.show()
      },
    },
    timers: {
      setInterval: (callback, milliseconds) =>
        setInterval(callback, milliseconds),
    },
    logError: (error) => {
      console.warn(
        'Update check or notification failed; try again later.',
        error,
      )
    },
  })
}
