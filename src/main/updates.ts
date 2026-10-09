import type { IpcMain } from 'electron'
import { IPC_CHANNELS, type UpdateState } from '../shared/ipc'
import { registerIpcHandler } from './ipc'

export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

type UpdaterEvent = 'download-progress' | 'update-downloaded' | 'error'

export interface UpdaterLike {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  autoRunAppAfterInstall: boolean
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
  let restartRecovery: Promise<void> | null = null
  let callingQuitAndInstall = false
  let sawSynchronousInstallError = false
  let synchronousInstallError: unknown
  let notificationShown = false

  const publish = (nextState: UpdateState) => {
    state = nextState
    try {
      options.window.send(state)
    } catch (error) {
      options.logError(error)
    }
  }

  const recoverRestart = (
    error: unknown,
    notifyRenderer: boolean,
    logUpdaterError: boolean,
  ): Promise<void> => {
    if (restartRecovery) return restartRecovery
    if (logUpdaterError) options.logError(error)
    const version = state.status === 'ready' ? state.version : null
    restartRecovery = (async () => {
      try {
        await options.recoverAfterFailure()
      } catch (recoveryError) {
        options.logError(recoveryError)
      } finally {
        restarting = false
        restartRecovery = null
        if (notifyRenderer && version)
          publish({ status: 'ready', version, installError: true })
      }
    })()
    return restartRecovery
  }

  registerIpcHandler(options.ipcMain, IPC_CHANNELS.updatesState, () => state)
  registerIpcHandler(
    options.ipcMain,
    IPC_CHANNELS.updatesJustUpdated,
    () => options.justUpdatedVersion,
  )
  registerIpcHandler(options.ipcMain, IPC_CHANNELS.updatesRestart, async () => {
    if (!options.packaged || state.status !== 'ready' || restarting) return
    const version = state.version
    restarting = true
    publish({ status: 'ready', version })
    try {
      // Shut down first because quit/install event ordering varies by platform.
      await options.beforeInstall()
    } catch (error) {
      await recoverRestart(error, false, true)
      throw error
    }
    let thrownInstallError: unknown
    let quitAndInstallThrew = false
    sawSynchronousInstallError = false
    synchronousInstallError = undefined
    callingQuitAndInstall = true
    try {
      // Keep the installer visible; autoRunAppAfterInstall relaunches afterward.
      options.updater.quitAndInstall(false, true)
    } catch (error) {
      quitAndInstallThrew = true
      thrownInstallError = error
    } finally {
      callingQuitAndInstall = false
    }
    if (quitAndInstallThrew) {
      await recoverRestart(thrownInstallError, true, true)
      throw new Error('updates.error', { cause: thrownInstallError })
    }
    if (sawSynchronousInstallError)
      await recoverRestart(synchronousInstallError, true, true)
  })

  if (!options.packaged) return

  options.updater.autoDownload = true
  // Never install on normal quit: a fast manual relaunch can race the running
  // installer. Installation happens only through the explicit restart action.
  options.updater.autoInstallOnAppQuit = false
  // Non-silent NSIS installs ignore quitAndInstall's force-run argument.
  options.updater.autoRunAppAfterInstall = true

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
  options.updater.on('error', (error) => {
    // Check/download errors are logged by the rejected check promise below.
    if (!restarting) return
    if (callingQuitAndInstall) {
      sawSynchronousInstallError = true
      synchronousInstallError = error
      return
    }
    // quitAndInstall already scheduled app.quit(); recovery would reopen data
    // and restart schedulers while the process is exiting.
    options.logError(error)
  })

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
