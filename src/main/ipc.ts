import type { IpcMain, IpcMainInvokeEvent } from 'electron'

interface TrustedWebContents {
  readonly mainFrame: unknown
}

let trustedWebContents: () => readonly TrustedWebContents[] = () => []

export function configureTrustedIpcWebContents(
  getWebContents: () => readonly TrustedWebContents[],
): void {
  trustedWebContents = getWebContents
}

export function inputRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('IPC input must be an object')
  }
  return value as Record<string, unknown>
}

export function assertTrustedIpcSender(event: IpcMainInvokeEvent): void {
  if (
    trustedWebContents().some(
      (contents) =>
        contents === event.sender && contents.mainFrame === event.senderFrame,
    )
  )
    return
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
