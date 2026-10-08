import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export function inputRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('IPC input must be an object')
  }
  return value as Record<string, unknown>
}

export function assertTrustedIpcSender(event: IpcMainInvokeEvent): void {
  const senderUrl = event.senderFrame?.url
  if (!senderUrl) throw new Error('IPC sender is not the application window')
  const expectedDevUrl = process.env.ELECTRON_RENDERER_URL
  if (expectedDevUrl) {
    if (new URL(senderUrl).origin === new URL(expectedDevUrl).origin) return
  } else {
    const expectedFile = pathToFileURL(
      join(import.meta.dirname, '../renderer/index.html'),
    )
    const actual = new URL(senderUrl)
    actual.hash = ''
    actual.search = ''
    if (actual.href === expectedFile.href) return
  }
  throw new Error('IPC sender is not the application window')
}

export function registerIpcHandler(
  ipcMain: IpcMain,
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown,
): void {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedIpcSender(event)
    return handler(event, ...args)
  })
}
