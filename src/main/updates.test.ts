import type { BrowserWindow, IpcMain } from 'electron'
import { beforeEach, expect, test, vi } from 'vitest'
import { IPC_CHANNELS } from '../shared/ipc'
import { registerUpdates } from './updates'
import { configureTrustedIpcWebContents } from './ipc'

const updater = vi.hoisted(() => ({
  autoDownload: false,
  autoInstallOnAppQuit: true,
  on: vi.fn(),
  checkForUpdates: vi.fn(),
  quitAndInstall: vi.fn(),
}))
vi.mock('electron-updater', () => ({ default: { autoUpdater: updater } }))

beforeEach(() => {
  vi.resetAllMocks()
  process.env.ELECTRON_RENDERER_URL = 'http://localhost:5173'
  updater.autoDownload = false
  updater.autoInstallOnAppQuit = true
  updater.checkForUpdates.mockResolvedValue(null)
})

function setup(
  packaged: boolean,
  beforeInstall = vi.fn(async () => {}),
  recoverAfterFailure = vi.fn(async () => {}),
) {
  const handle = vi.fn()
  const send = vi.fn()
  const isDestroyed = vi.fn(() => false)
  const mainFrame = { url: 'http://localhost:5173/index.html' }
  const webContents = { send, mainFrame }
  configureTrustedIpcWebContents(() => [webContents])
  registerUpdates(
    { handle } as unknown as IpcMain,
    { isDestroyed, webContents } as unknown as BrowserWindow,
    packaged,
    beforeInstall,
    recoverAfterFailure,
  )
  function invoke(channel: string): unknown {
    const handler = handle.mock.calls.find(([name]) => name === channel)?.[1]
    if (!handler) throw new Error('Missing IPC handler')
    return handler({ sender: webContents, senderFrame: mainFrame })
  }
  function emit(event: string) {
    const handler = updater.on.mock.calls.find(([name]) => name === event)?.[1]
    if (!handler) throw new Error('Missing updater listener')
    handler()
  }
  return {
    invoke,
    emit,
    send,
    isDestroyed,
    beforeInstall,
    recoverAfterFailure,
  }
}

test('development builds never check, download, or install updates', async () => {
  const app = setup(false)
  expect(app.invoke(IPC_CHANNELS.updatesIsReady)).toBe(false)
  await app.invoke(IPC_CHANNELS.updatesRestart)
  expect(updater.checkForUpdates).not.toHaveBeenCalled()
  expect(updater.on).not.toHaveBeenCalled()
  expect(updater.quitAndInstall).not.toHaveBeenCalled()
  expect(app.beforeInstall).not.toHaveBeenCalled()
})

test('packaged startup checks once and downloads but does not install on quit', async () => {
  const app = setup(true)
  expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
  expect(updater.autoDownload).toBe(true)
  expect(updater.autoInstallOnAppQuit).toBe(false)
  await app.invoke(IPC_CHANNELS.updatesRestart)
  expect(updater.quitAndInstall).not.toHaveBeenCalled()
})

test('a downloaded update is queryable and notifies the renderer', () => {
  const app = setup(true)
  expect(app.invoke(IPC_CHANNELS.updatesIsReady)).toBe(false)
  app.emit('update-downloaded')
  expect(app.invoke(IPC_CHANNELS.updatesIsReady)).toBe(true)
  expect(app.send).toHaveBeenCalledWith(IPC_CHANNELS.updatesReady)
})

test('a download finishing after the window closes does not send to it', () => {
  const app = setup(true)
  app.isDestroyed.mockReturnValue(true)
  app.emit('update-downloaded')
  expect(app.send).not.toHaveBeenCalled()
})

test('restart waits for database shutdown and ignores duplicate requests', async () => {
  let finish: (() => void) | undefined
  const shutdown = vi.fn(
    () => new Promise<void>((resolve) => (finish = resolve)),
  )
  const app = setup(true, shutdown)
  app.emit('update-downloaded')
  const restart = app.invoke(IPC_CHANNELS.updatesRestart)
  await app.invoke(IPC_CHANNELS.updatesRestart)
  expect(shutdown).toHaveBeenCalledTimes(1)
  expect(updater.quitAndInstall).not.toHaveBeenCalled()
  finish?.()
  await restart
  expect(updater.quitAndInstall).toHaveBeenCalledWith(true, true)
})

test('a failed shutdown does not start the installer', async () => {
  const shutdown = vi.fn(async () => {
    throw new Error('Shutdown failed')
  })
  const app = setup(true, shutdown)
  app.emit('update-downloaded')
  await expect(app.invoke(IPC_CHANNELS.updatesRestart)).rejects.toThrow(
    'Shutdown failed',
  )
  expect(updater.quitAndInstall).not.toHaveBeenCalled()
})

test('a failed installer restart recovers the profile controller and surfaces a message key', async () => {
  updater.quitAndInstall.mockImplementation(() => {
    throw new Error('Installer failed')
  })
  const recover = vi.fn(async () => {})
  const app = setup(
    true,
    vi.fn(async () => {}),
    recover,
  )
  app.emit('update-downloaded')
  await expect(app.invoke(IPC_CHANNELS.updatesRestart)).rejects.toThrow(
    'updates.error',
  )
  expect(recover).toHaveBeenCalledTimes(1)
})

test('offline checks do not reject startup or announce a downloaded update', async () => {
  updater.checkForUpdates.mockRejectedValue(new Error('Offline'))
  const app = setup(true)
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    app.emit('error')
    await Promise.resolve()
    expect(warning).toHaveBeenCalledTimes(1)
    expect(app.invoke(IPC_CHANNELS.updatesIsReady)).toBe(false)
    expect(app.send).not.toHaveBeenCalled()
  } finally {
    warning.mockRestore()
  }
})
