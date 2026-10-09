import type { IpcMain } from 'electron'
import { IPC_CHANNELS, type UpdateState } from '../shared/ipc'
import { registerIpcHandler } from './ipc'

export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

type UpdaterEvent = 'download-progress' | 'update-downloaded' | 'error'

export interface UpdaterLike {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  on(event: UpdaterEvent, listener: (value: unknown) => void): unknown
  checkForUpdates(): unknown
  quitAndInstall(isSilent: boolean, isForceRunAfter: boolean): void
}

interface UpdateWindowSink {
  send(state: UpdateState): void
  isVisible(): boolean
  show(): void
}

interface UpdateNotificationSink {
  show(version: string, onClick: () => void): void
}

interface UpdateTimerSink {
  setInterval(callback: () => void, milliseconds: number): unknown
}

interface RegisterUpdatesOptions {
  ipcMain: IpcMain
  updater: UpdaterLike
  packaged: boolean
  justUpdatedVersion: string | null
  beforeInstall: () => Promise<void>
  recoverAfterFailure: () => Promise<void>
  window: UpdateWindowSink
  notifications: UpdateNotificationSink
  timers: UpdateTimerSink
  logError: (error: unknown) => void
}

function downloadPromise(result: unknown): Promise<unknown> | null {
  if (!result || typeof result !== 'object') return null
  const value = (result as { downloadPromise?: unknown }).downloadPromise
  return value && typeof (value as PromiseLike<unknown>).then === 'function'
    ? Promise.resolve(value)
    : null
}

function progressPercent(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null
  const percent = (value as { percent?: unknown }).percent
  return typeof percent === 'number' && Number.isFinite(percent)
    ? Math.round(percent)
    : null
}

function downloadedVersion(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const version = (value as { version?: unknown }).version
  return typeof version === 'string' && version.length > 0 ? version : null
}

export function registerUpdates(options: RegisterUpdatesOptions): void {
  let state: UpdateState = { status: 'idle' }
  let inFlight = false
  let restarting = false
  let notificationShown = false

  registerIpcHandler(options.ipcMain, IPC_CHANNELS.updatesState, () => state)
  registerIpcHandler(
    options.ipcMain,
    IPC_CHANNELS.updatesJustUpdated,
    () => options.justUpdatedVersion,
  )
  registerIpcHandler(options.ipcMain, IPC_CHANNELS.updatesRestart, async () => {
    if (!options.packaged || state.status !== 'ready' || restarting) return
    restarting = true
    try {
      // electron-updater closes windows before Electron's before-quit event.
      await options.beforeInstall()
    } catch (error) {
      restarting = false
      throw error
    }
    try {
      // Keep the installer visible and force the updated app to relaunch.
      options.updater.quitAndInstall(false, true)
    } catch (error) {
      restarting = false
      await options.recoverAfterFailure()
      throw new Error('updates.error', { cause: error })
    }
  })

  if (!options.packaged) return

  options.updater.autoDownload = true
  // Never install on normal quit: a fast manual relaunch can race the running
  // installer. Installation happens only through the explicit restart action.
  options.updater.autoInstallOnAppQuit = false

  const publish = (nextState: UpdateState) => {
    state = nextState
    try {
      options.window.send(state)
    } catch (error) {
      options.logError(error)
    }
  }

  options.updater.on('download-progress', (value) => {
    if (state.status === 'ready') return
    const percent = progressPercent(value)
    if (percent === null) return
    inFlight = true
    publish({ status: 'downloading', percent })
  })
  options.updater.on('update-downloaded', (value) => {
    const version = downloadedVersion(value)
    if (version === null) return
    const wasAlreadyReady = state.status === 'ready'
    publish({ status: 'ready', version })
    if (wasAlreadyReady || notificationShown || options.window.isVisible())
      return
    notificationShown = true
    try {
      options.notifications.show(version, () => options.window.show())
    } catch (error) {
      options.logError(error)
    }
  })
  options.updater.on('error', (error) => options.logError(error))

  const check = async () => {
    if (inFlight || state.status === 'ready') return
    inFlight = true
    try {
      const result = await options.updater.checkForUpdates()
      const downloading = downloadPromise(result)
      if (downloading) await downloading
    } catch (error) {
      options.logError(error)
    } finally {
      inFlight = false
      if (state.status === 'downloading') publish({ status: 'idle' })
    }
  }

  void check()
  options.timers.setInterval(() => void check(), UPDATE_CHECK_INTERVAL_MS)
}
