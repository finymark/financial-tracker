import { BrowserWindow, dialog, shell, type IpcMain } from 'electron'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { StagedAttachment } from '../../shared/attachments'
import { IPC_CHANNELS, type AppBridge } from '../../shared/ipc'
import { UUID_PATTERN } from '../../shared/validation'
import { inputRecord, registerIpcHandler } from '../ipc'
import type { ProfileController } from './profile-controller'

function stringProperty(input: Record<string, unknown>, key: string): string {
  const value = input[key]
  if (typeof value !== 'string') throw new Error('attachments.error.staged')
  return value
}

export function parseStagedAttachment(value: unknown): StagedAttachment {
  const input = inputRecord(value)
  const byteSize = input.byteSize
  if (!Number.isSafeInteger(byteSize))
    throw new Error('attachments.error.staged')
  return {
    originalFileName: stringProperty(input, 'originalFileName'),
    storedName: stringProperty(input, 'storedName'),
    mediaType: stringProperty(
      input,
      'mediaType',
    ) as StagedAttachment['mediaType'],
    byteSize: byteSize as number,
  }
}

function idProperty(input: Record<string, unknown>, key: string): string {
  const id = stringProperty(input, key)
  if (!UUID_PATTERN.test(id)) throw new Error('attachments.error.notFound')
  return id
}

function parentWindow(
  event: Electron.IpcMainInvokeEvent,
): Electron.BrowserWindow {
  const parent = BrowserWindow.fromWebContents(event.sender)
  if (!parent)
    throw new Error('Attachment dialog requires the application window')
  return parent
}

export function registerAttachmentIpc(
  ipcMain: IpcMain,
  controller: ProfileController,
): () => void {
  const temporaryDirectory = mkdtempSync(
    join(tmpdir(), 'financial-tracker-open-'),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.attachmentsPick,
    async (event): ReturnType<AppBridge['attachments']['pick']> => {
      const result = await dialog.showOpenDialog(parentWindow(event), {
        properties: ['openFile', 'multiSelections'],
        filters: [
          {
            name: 'Images and PDF',
            extensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
          },
        ],
      })
      return result.canceled ? [] : result.filePaths
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.attachmentsPickCopyFolder,
    async (event): ReturnType<AppBridge['attachments']['pickCopyFolder']> => {
      const result = await dialog.showOpenDialog(parentWindow(event), {
        properties: ['openDirectory', 'createDirectory'],
      })
      return result.canceled ? null : (result.filePaths[0] ?? null)
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.attachmentsImport,
    (_event, value): ReturnType<AppBridge['attachments']['import']> => {
      const input = inputRecord(value)
      return controller
        .getActiveApplication()
        .commands.importAttachment(stringProperty(input, 'path'))
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.attachmentsList,
    (_event, value): Awaited<ReturnType<AppBridge['attachments']['list']>> => {
      const input = inputRecord(value)
      return controller
        .getActiveApplication()
        .queries.listAttachments(idProperty(input, 'transactionId'))
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.attachmentsAttach,
    (
      _event,
      value,
    ): Awaited<ReturnType<AppBridge['attachments']['attach']>> => {
      const input = inputRecord(value)
      return controller
        .getActiveApplication()
        .commands.attachAttachment(
          idProperty(input, 'transactionId'),
          parseStagedAttachment(input.attachment),
        )
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.attachmentsRemove,
    (_event, value): void => {
      controller
        .getActiveApplication()
        .commands.removeAttachment(idProperty(inputRecord(value), 'id'))
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.attachmentsOpen,
    async (_event, value): Promise<void> => {
      const input = inputRecord(value)
      const hasId = input.id !== undefined
      const hasAttachment = input.attachment !== undefined
      if (hasId === hasAttachment) throw new Error('attachments.error.staged')
      const openInput = hasId
        ? { id: idProperty(input, 'id') }
        : { attachment: parseStagedAttachment(input.attachment) }
      const path = controller
        .getActiveApplication()
        .commands.copyAttachmentForOpening(openInput, temporaryDirectory)
      const error = await shell.openPath(path)
      if (error) throw new Error('attachments.error.open')
    },
  )
  return () => rmSync(temporaryDirectory, { recursive: true, force: true })
}
