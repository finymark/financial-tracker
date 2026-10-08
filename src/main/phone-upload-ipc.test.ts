import type { IpcMain } from 'electron'
import { beforeEach, expect, test, vi } from 'vitest'
import { IPC_CHANNELS } from '../shared/ipc'
import { configureTrustedIpcWebContents } from './ipc'
import {
  registerPhoneUploadIpc,
  type PhoneUploadIpcOptions,
} from './phone-upload-ipc'
import type {
  PhoneUploadServerOptions,
  PhoneUploadServerSession,
} from './phone-upload-server'

function networkAddress(address: string) {
  return {
    address,
    netmask: '255.255.255.0',
    family: 'IPv4' as const,
    mac: '00:00:00:00:00:00',
    internal: false,
    cidr: `${address}/24`,
  }
}

function setup() {
  const handlers = new Map<string, (...arguments_: unknown[]) => unknown>()
  const ipcMain = {
    handle(channel: string, handler: (...arguments_: unknown[]) => unknown) {
      handlers.set(channel, handler)
    },
  } as unknown as IpcMain
  const frame = { url: 'app://main' }
  const contents = { mainFrame: frame }
  configureTrustedIpcWebContents(() => [contents])
  const event = { sender: contents, senderFrame: frame }
  const invoke = (channel: string, value: unknown) =>
    handlers.get(channel)!(event, value)

  const sessions: Array<
    PhoneUploadServerSession & { stop: ReturnType<typeof vi.fn> }
  > = []
  const starts: PhoneUploadServerOptions[] = []
  const startServer = vi.fn(async (options: PhoneUploadServerOptions) => {
    starts.push(options)
    const stop = vi.fn(async () => {})
    const session = {
      url: `http://${options.bindAddress}/u/${options.token}`,
      expiresAt: options.expiresAt!,
      stop,
    }
    sessions.push(session)
    return session
  })
  const intake = vi.fn(async () => undefined)
  const options: PhoneUploadIpcOptions = {
    getActiveProfile: () => ({ id: 'profile-a', language: 'en', intake }),
    getNetworkInterfaces: () => ({
      First: [networkAddress('192.168.1.10')],
      Second: [networkAddress('192.168.2.10')],
    }),
    clock: () => 1_000,
    startServer,
    renderQr: async (url) => `qr:${url}`,
  }
  const registration = registerPhoneUploadIpc(ipcMain, options)
  return { invoke, registration, sessions, starts, intake }
}

beforeEach(() => configureTrustedIpcWebContents(() => []))

test('dialog close stops only the phone-upload session with the matching id', async () => {
  const context = setup()
  await context.invoke(IPC_CHANNELS.phoneUploadStart, { dialogId: 'dialog-a' })

  await context.invoke(IPC_CHANNELS.phoneUploadStop, { dialogId: 'dialog-b' })
  expect(context.sessions[0].stop).not.toHaveBeenCalled()
  await context.invoke(IPC_CHANNELS.phoneUploadStop, { dialogId: 'dialog-a' })
  expect(context.sessions[0].stop).toHaveBeenCalledOnce()
})

test('profile-change stop closes the current phone-upload session first', async () => {
  const context = setup()
  await context.invoke(IPC_CHANNELS.phoneUploadStart, { dialogId: 'dialog-a' })

  await context.registration.stop()

  expect(context.sessions[0].stop).toHaveBeenCalledOnce()
  expect(context.intake).not.toHaveBeenCalled()
})

test('switching interface retains the phone-upload token and expiry', async () => {
  const context = setup()
  const first = await context.invoke(IPC_CHANNELS.phoneUploadStart, {
    dialogId: 'dialog-a',
    address: '192.168.1.10',
  })
  const second = await context.invoke(IPC_CHANNELS.phoneUploadStart, {
    dialogId: 'dialog-a',
    address: '192.168.2.10',
  })

  expect(context.sessions[0].stop).toHaveBeenCalledOnce()
  expect(context.starts[1].token).toBe(context.starts[0].token)
  expect(context.starts[1].expiresAt).toBe(context.starts[0].expiresAt)
  expect(second).toMatchObject({
    selectedAddress: '192.168.2.10',
    expiresAt: (first as { expiresAt: number }).expiresAt,
  })
})
