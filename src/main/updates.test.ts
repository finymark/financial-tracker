import type { IpcMain } from 'electron'
import { beforeEach, expect, test, vi } from 'vitest'
import { IPC_CHANNELS, type UpdateState } from '../shared/ipc'
import { configureTrustedIpcWebContents } from './ipc'
import { registerUpdates, UPDATE_CHECK_INTERVAL_MS } from './updates'

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
  reject(error: unknown): void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function setup(
  options: {
    packaged?: boolean
    visible?: boolean
    justUpdatedVersion?: string | null
    beforeInstall?: () => Promise<void>
    recoverAfterFailure?: () => Promise<void>
  } = {},
) {
  const listeners = new Map<string, (value: never) => void>()
  const updater = {
    autoDownload: false,
    autoInstallOnAppQuit: true,
    autoRunAppAfterInstall: false,
    on: vi.fn((event: string, listener: (value: never) => void) => {
      listeners.set(event, listener)
    }),
    checkForUpdates: vi.fn<() => Promise<unknown>>(() => Promise.resolve(null)),
    quitAndInstall: vi.fn(),
  }
  const handle = vi.fn()
  const send = vi.fn()
  const isVisible = vi.fn(() => options.visible ?? true)
  const show = vi.fn()
  let notificationClick: (() => void) | undefined
  const notify = vi.fn((_version: string, onClick: () => void) => {
    notificationClick = onClick
  })
  let intervalCallback: (() => void) | undefined
  const setInterval = vi.fn((callback: () => void) => {
    intervalCallback = callback
    return 1
  })
  const logError = vi.fn()
  const beforeInstall = options.beforeInstall ?? vi.fn(async () => {})
  const recoverAfterFailure =
    options.recoverAfterFailure ?? vi.fn(async () => {})
  const mainFrame = { url: 'http://localhost:5173/index.html' }
  const webContents = { mainFrame }
  configureTrustedIpcWebContents(() => [webContents])

  registerUpdates({
    ipcMain: { handle } as unknown as IpcMain,
    updater,
    packaged: options.packaged ?? true,
    justUpdatedVersion: options.justUpdatedVersion ?? null,
    beforeInstall,
    recoverAfterFailure,
    timers: { setInterval },
    window: { send, isVisible, show },
    notifications: { show: notify },
    logError,
  })

  function invoke(channel: string): unknown {
    const handler = handle.mock.calls.find(([name]) => name === channel)?.[1]
    if (!handler) throw new Error(`Missing IPC handler: ${channel}`)
    return handler({ sender: webContents, senderFrame: mainFrame })
  }

  function emit(event: string, value?: unknown): void {
    const listener = listeners.get(event)
    if (!listener) throw new Error(`Missing updater listener: ${event}`)
    listener(value as never)
  }

  return {
    updater,
    invoke,
    emit,
    send,
    isVisible,
    show,
    notify,
    clickNotification: () => notificationClick?.(),
    setInterval,
    runInterval: () => intervalCallback?.(),
    logError,
    beforeInstall,
    recoverAfterFailure,
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
  process.env.ELECTRON_RENDERER_URL = 'http://localhost:5173'
})

test('development builds expose idle state but never initialise the updater', async () => {
  const app = setup({ packaged: false, justUpdatedVersion: '0.5.1' })

  expect(app.invoke(IPC_CHANNELS.updatesState)).toEqual({ status: 'idle' })
  expect(app.invoke(IPC_CHANNELS.updatesJustUpdated)).toBe('0.5.1')
  await app.invoke(IPC_CHANNELS.updatesRestart)
  expect(app.updater.on).not.toHaveBeenCalled()
  expect(app.updater.checkForUpdates).not.toHaveBeenCalled()
  expect(app.updater.quitAndInstall).not.toHaveBeenCalled()
  expect(app.setInterval).not.toHaveBeenCalled()
  expect(app.updater.autoDownload).toBe(false)
  expect(app.updater.autoInstallOnAppQuit).toBe(true)
  expect(app.updater.autoRunAppAfterInstall).toBe(false)
})

test('packaged startup enables downloads, disables install-on-quit, and schedules six-hour checks', () => {
  const app = setup()

  expect(app.updater.autoDownload).toBe(true)
  expect(app.updater.autoInstallOnAppQuit).toBe(false)
  expect(app.updater.autoRunAppAfterInstall).toBe(true)
  expect(app.updater.checkForUpdates).toHaveBeenCalledTimes(1)
  expect(app.setInterval).toHaveBeenCalledWith(
    expect.any(Function),
    UPDATE_CHECK_INTERVAL_MS,
  )
  expect(UPDATE_CHECK_INTERVAL_MS).toBe(6 * 60 * 60 * 1000)
  expect(app.updater.quitAndInstall).not.toHaveBeenCalled()
})

test('rounded download progress and the ready version are pushed and remain pullable', () => {
  const app = setup()

  app.emit('download-progress', { percent: 41.6 })
  const downloading: UpdateState = { status: 'downloading', percent: 42 }
  expect(app.send).toHaveBeenLastCalledWith(downloading)
  expect(app.invoke(IPC_CHANNELS.updatesState)).toEqual(downloading)

  app.emit('update-downloaded', { version: '0.5.1' })
  const ready: UpdateState = { status: 'ready', version: '0.5.1' }
  expect(app.send).toHaveBeenLastCalledWith(ready)
  expect(app.invoke(IPC_CHANNELS.updatesState)).toEqual(ready)
})

test('scheduled checks are skipped while a check or download is in flight and after an update is ready', async () => {
  const checking = deferred<unknown>()
  const downloading = deferred<unknown>()
  const app = setup()
  await Promise.resolve()
  app.updater.checkForUpdates.mockClear()
  app.updater.checkForUpdates.mockReturnValue(checking.promise)

  app.runInterval()
  app.runInterval()
  expect(app.updater.checkForUpdates).toHaveBeenCalledTimes(1)

  checking.resolve({ downloadPromise: downloading.promise })
  await Promise.resolve()
  app.runInterval()
  expect(app.updater.checkForUpdates).toHaveBeenCalledTimes(1)

  app.emit('update-downloaded', { version: '0.5.1' })
  downloading.resolve(undefined)
  await downloading.promise
  await Promise.resolve()
  app.runInterval()
  expect(app.updater.checkForUpdates).toHaveBeenCalledTimes(1)
})

test('failed checks are logged, swallowed, and do not stop later checks', async () => {
  const app = setup()
  await Promise.resolve()
  app.updater.checkForUpdates.mockClear()
  const error = new Error('Offline')
  app.updater.checkForUpdates.mockRejectedValueOnce(error)
  app.updater.checkForUpdates.mockResolvedValue(null)

  app.runInterval()
  app.emit('error', error)
  await Promise.resolve()
  await Promise.resolve()
  expect(app.logError).toHaveBeenCalledTimes(1)
  expect(app.logError).toHaveBeenCalledWith(error)
  app.runInterval()
  expect(app.updater.checkForUpdates).toHaveBeenCalledTimes(2)
  expect(app.invoke(IPC_CHANNELS.updatesState)).toEqual({ status: 'idle' })
})

test('a failed download resets progress to idle and allows the next scheduled check', async () => {
  const download = deferred<unknown>()
  const app = setup()
  await Promise.resolve()
  app.updater.checkForUpdates.mockClear()
  app.updater.checkForUpdates
    .mockResolvedValueOnce({ downloadPromise: download.promise })
    .mockResolvedValue(null)

  app.runInterval()
  await Promise.resolve()
  app.emit('download-progress', { percent: 18.4 })
  expect(app.invoke(IPC_CHANNELS.updatesState)).toEqual({
    status: 'downloading',
    percent: 18,
  })

  const error = new Error('Download failed')
  app.emit('error', error)
  download.reject(error)
  await download.promise.catch(() => {})
  await Promise.resolve()
  expect(app.invoke(IPC_CHANNELS.updatesState)).toEqual({ status: 'idle' })
  expect(app.logError).toHaveBeenCalledTimes(1)

  app.runInterval()
  expect(app.updater.checkForUpdates).toHaveBeenCalledTimes(2)
})

test('a cached downloaded update becomes ready without progress events', () => {
  const app = setup()

  app.emit('update-downloaded', { version: '0.5.1' })

  expect(app.invoke(IPC_CHANNELS.updatesState)).toEqual({
    status: 'ready',
    version: '0.5.1',
  })
  expect(app.send).toHaveBeenCalledTimes(1)
})

test('ready state is retained when the updater download promise resolves', async () => {
  const check = deferred<unknown>()
  const download = deferred<unknown>()
  const app = setup()
  await Promise.resolve()
  app.updater.checkForUpdates.mockClear()
  app.updater.checkForUpdates.mockReturnValue(check.promise)

  app.runInterval()
  check.resolve({ downloadPromise: download.promise })
  await Promise.resolve()
  app.emit('update-downloaded', { version: '0.5.1' })
  download.resolve(undefined)
  await download.promise
  await Promise.resolve()

  expect(app.invoke(IPC_CHANNELS.updatesState)).toEqual({
    status: 'ready',
    version: '0.5.1',
  })
})

test('a hidden window gets one notification and clicking it shows the window', () => {
  const app = setup({ visible: false })

  app.emit('update-downloaded', { version: '0.5.1' })
  app.emit('update-downloaded', { version: '0.5.1' })
  expect(app.notify).toHaveBeenCalledTimes(1)
  expect(app.notify).toHaveBeenCalledWith('0.5.1', expect.any(Function))
  app.clickNotification()
  expect(app.show).toHaveBeenCalledTimes(1)
})

test('a visible window does not get a native update notification', () => {
  const app = setup({ visible: true })
  app.emit('update-downloaded', { version: '0.5.1' })
  expect(app.notify).not.toHaveBeenCalled()
})

test('restart closes application data before visibly installing and ignores duplicate requests', async () => {
  const shutdown = deferred<void>()
  const beforeInstall = vi.fn(() => shutdown.promise)
  const app = setup({ beforeInstall })
  app.emit('update-downloaded', { version: '0.5.1' })

  const restart = app.invoke(IPC_CHANNELS.updatesRestart)
  await app.invoke(IPC_CHANNELS.updatesRestart)
  expect(beforeInstall).toHaveBeenCalledTimes(1)
  expect(app.updater.quitAndInstall).not.toHaveBeenCalled()

  shutdown.resolve(undefined)
  await restart
  expect(app.updater.quitAndInstall).toHaveBeenCalledTimes(1)
  expect(app.updater.quitAndInstall).toHaveBeenCalledWith(false, true)
  expect(beforeInstall.mock.invocationCallOrder[0]).toBeLessThan(
    app.updater.quitAndInstall.mock.invocationCallOrder[0],
  )
})

test('a failed shutdown recovers before rejecting and allows another restart attempt', async () => {
  const recoverAfterFailure = vi.fn(async () => {})
  const error = new Error('Shutdown failed')
  const app = setup({
    beforeInstall: vi.fn(async () => {
      throw error
    }),
    recoverAfterFailure,
  })
  app.emit('update-downloaded', { version: '0.5.1' })

  await expect(app.invoke(IPC_CHANNELS.updatesRestart)).rejects.toThrow(
    'Shutdown failed',
  )
  expect(app.updater.quitAndInstall).not.toHaveBeenCalled()
  expect(recoverAfterFailure).toHaveBeenCalledTimes(1)
  expect(app.logError).toHaveBeenCalledTimes(1)
  expect(app.logError).toHaveBeenCalledWith(error)

  await expect(app.invoke(IPC_CHANNELS.updatesRestart)).rejects.toThrow(
    'Shutdown failed',
  )
  expect(recoverAfterFailure).toHaveBeenCalledTimes(2)
  expect(app.logError).toHaveBeenCalledTimes(2)
})

test('a synchronous updater error during quitAndInstall recovers and allows a retry', async () => {
  const recoverAfterFailure = vi.fn(async () => {})
  const app = setup({ recoverAfterFailure })
  app.emit('update-downloaded', { version: '0.5.1' })
  const error = new Error('Installer failed')
  app.updater.quitAndInstall.mockImplementationOnce(() => {
    app.emit('error', error)
  })

  await app.invoke(IPC_CHANNELS.updatesRestart)

  expect(recoverAfterFailure).toHaveBeenCalledTimes(1)
  expect(app.logError).toHaveBeenCalledTimes(1)
  expect(app.logError).toHaveBeenCalledWith(error)
  expect(app.send).toHaveBeenLastCalledWith({
    status: 'ready',
    version: '0.5.1',
    installError: true,
  })
  expect(app.invoke(IPC_CHANNELS.updatesState)).toEqual({
    status: 'ready',
    version: '0.5.1',
    installError: true,
  })

  await app.invoke(IPC_CHANNELS.updatesRestart)
  expect(app.updater.quitAndInstall).toHaveBeenCalledTimes(2)
})

test('an updater error after quitAndInstall returns is only logged because quit is already scheduled', async () => {
  const recoverAfterFailure = vi.fn(async () => {})
  const app = setup({ recoverAfterFailure })
  app.emit('update-downloaded', { version: '0.5.1' })

  await app.invoke(IPC_CHANNELS.updatesRestart)
  const error = new Error('Asynchronous NSIS spawn failure')
  app.emit('error', error)
  await Promise.resolve()

  expect(app.logError).toHaveBeenCalledTimes(1)
  expect(app.logError).toHaveBeenCalledWith(error)
  expect(recoverAfterFailure).not.toHaveBeenCalled()
  expect(app.invoke(IPC_CHANNELS.updatesState)).toEqual({
    status: 'ready',
    version: '0.5.1',
  })
})

test('a thrown quitAndInstall failure recovers and rejects with the renderer error key', async () => {
  const recoverAfterFailure = vi.fn(async () => {})
  const app = setup({ recoverAfterFailure })
  const error = new Error('quitAndInstall threw')
  app.updater.quitAndInstall.mockImplementation(() => {
    throw error
  })
  app.emit('update-downloaded', { version: '0.5.1' })

  await expect(app.invoke(IPC_CHANNELS.updatesRestart)).rejects.toThrow(
    'updates.error',
  )
  expect(app.logError).toHaveBeenCalledTimes(1)
  expect(app.logError).toHaveBeenCalledWith(error)
  expect(recoverAfterFailure).toHaveBeenCalledTimes(1)
  expect(app.invoke(IPC_CHANNELS.updatesState)).toEqual({
    status: 'ready',
    version: '0.5.1',
    installError: true,
  })
})
