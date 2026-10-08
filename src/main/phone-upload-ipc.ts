import { randomBytes } from 'node:crypto'
import { networkInterfaces } from 'node:os'
import type { IpcMain } from 'electron'
import { toDataURL } from 'qrcode'
import { IPC_CHANNELS, type AppBridge } from '../shared/ipc'
import type {
  PhoneUploadReceivedEvent,
  PhoneUploadSessionInfo,
  PhoneUploadStartInput,
  PhoneUploadStopInput,
} from '../shared/phone-upload'
import type { Language } from '../shared/settings'
import { inputRecord, registerIpcHandler } from './ipc'
import {
  PHONE_UPLOAD_DURATION_MS,
  privateIpv4Interfaces,
  startPhoneUploadServer,
  type PhoneUploadServerSession,
  type PhoneUploadServerState,
  type ReceiptIntake,
} from './phone-upload-server'

export interface ActivePhoneUploadProfile {
  id: string
  language: Language
  intake: ReceiptIntake
}

export interface PhoneUploadIpcOptions {
  getActiveProfile(): ActivePhoneUploadProfile
  onReceived?(event: PhoneUploadReceivedEvent): void
  getNetworkInterfaces?: typeof networkInterfaces
  clock?: () => number
}

export interface PhoneUploadIpcRegistration {
  /** Stops the captured profile's session on profile close/switch or app quit. */
  stop(): Promise<void>
}

interface OpenSession {
  dialogId: string
  profile: ActivePhoneUploadProfile
  interfaces: ReturnType<typeof privateIpv4Interfaces>
  selectedAddress: string
  token: string
  expiresAt: number
  state: PhoneUploadServerState
  server: PhoneUploadServerSession
  qrDataUrl: string
}

function requiredDialogId(input: Record<string, unknown>): string {
  const value = input.dialogId
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 100 ||
    !/^[A-Za-z0-9-]+$/.test(value)
  )
    throw new TypeError('IPC property dialogId is invalid')
  return value
}

function parseStartInput(value: unknown): PhoneUploadStartInput {
  const input = inputRecord(value)
  const address = input.address
  if (address !== undefined && typeof address !== 'string')
    throw new TypeError('IPC property address must be a string')
  return {
    dialogId: requiredDialogId(input),
    ...(address === undefined ? {} : { address }),
  }
}

function parseStopInput(value: unknown): PhoneUploadStopInput {
  return { dialogId: requiredDialogId(inputRecord(value)) }
}

async function qrDataUrl(url: string): Promise<string> {
  return toDataURL(url, {
    type: 'image/png',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 320,
  })
}

function sessionInfo(session: OpenSession): PhoneUploadSessionInfo {
  return {
    available: true,
    dialogId: session.dialogId,
    url: session.server.url,
    qrDataUrl: session.qrDataUrl,
    interfaces: session.interfaces,
    selectedAddress: session.selectedAddress,
    expiresAt: session.expiresAt,
    uploadedCount: session.state.uploadedCount,
  }
}

export function registerPhoneUploadIpc(
  ipcMain: IpcMain,
  options: PhoneUploadIpcOptions,
): PhoneUploadIpcRegistration {
  const clock = options.clock ?? Date.now
  const getInterfaces = options.getNetworkInterfaces ?? networkInterfaces
  let current: OpenSession | null = null
  let pending: Promise<unknown> = Promise.resolve()

  function serialized<Result>(
    operation: () => Promise<Result>,
  ): Promise<Result> {
    const result = pending.then(operation, operation)
    pending = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  async function stopCurrent(dialogId?: string): Promise<void> {
    if (!current || (dialogId !== undefined && current.dialogId !== dialogId))
      return
    const stopping = current
    current = null
    await stopping.server.stop()
  }

  async function open(
    input: PhoneUploadStartInput,
  ): Promise<Awaited<ReturnType<AppBridge['phoneUpload']['start']>>> {
    if (current && current.dialogId !== input.dialogId) await stopCurrent()
    if (current && clock() >= current.expiresAt) {
      await stopCurrent(input.dialogId)
      throw new Error('phoneUpload.error.expired')
    }

    if (current) {
      const selected = input.address ?? current.selectedAddress
      if (!current.interfaces.some(({ address }) => address === selected))
        throw new Error('phoneUpload.error.interface')
      if (selected === current.selectedAddress) return sessionInfo(current)

      const previous = current
      current = null
      await previous.server.stop()
      let server: PhoneUploadServerSession | null = null
      try {
        server = await startPhoneUploadServer({
          bindAddress: selected,
          language: previous.profile.language,
          intake: previous.profile.intake,
          token: previous.token,
          expiresAt: previous.expiresAt,
          state: previous.state,
          clock,
          onUploaded: (uploadedCount) => {
            if (current?.dialogId === previous.dialogId)
              options.onReceived?.({
                dialogId: previous.dialogId,
                uploadedCount,
              })
          },
        })
        const rebound: OpenSession = {
          ...previous,
          selectedAddress: selected,
          server,
          qrDataUrl: await qrDataUrl(server.url),
        }
        current = rebound
        return sessionInfo(rebound)
      } catch (error) {
        await server?.stop()
        throw error
      }
    }

    const interfaces = privateIpv4Interfaces(getInterfaces())
    if (interfaces.length === 0)
      return { available: false, reason: 'no-private-network' }
    const selectedAddress = input.address ?? interfaces[0].address
    if (!interfaces.some(({ address }) => address === selectedAddress))
      throw new Error('phoneUpload.error.interface')
    const profile = options.getActiveProfile()
    const token = randomBytes(32).toString('base64url')
    const expiresAt = clock() + PHONE_UPLOAD_DURATION_MS
    const state: PhoneUploadServerState = {
      uploadedCount: 0,
      activeUploads: 0,
    }
    let server: PhoneUploadServerSession | null = null
    try {
      server = await startPhoneUploadServer({
        bindAddress: selectedAddress,
        language: profile.language,
        intake: profile.intake,
        token,
        expiresAt,
        state,
        clock,
        onUploaded: (uploadedCount) => {
          if (current?.dialogId === input.dialogId)
            options.onReceived?.({ dialogId: input.dialogId, uploadedCount })
        },
      })
      const opened: OpenSession = {
        dialogId: input.dialogId,
        profile,
        interfaces,
        selectedAddress,
        token,
        expiresAt,
        state,
        server,
        qrDataUrl: await qrDataUrl(server.url),
      }
      current = opened
      return sessionInfo(opened)
    } catch (error) {
      await server?.stop()
      throw error
    }
  }

  registerIpcHandler(ipcMain, IPC_CHANNELS.phoneUploadStart, (_event, value) =>
    serialized(() => open(parseStartInput(value))),
  )
  registerIpcHandler(ipcMain, IPC_CHANNELS.phoneUploadStop, (_event, value) => {
    const input = parseStopInput(value)
    return serialized(() => stopCurrent(input.dialogId))
  })

  return { stop: () => serialized(() => stopCurrent()) }
}
