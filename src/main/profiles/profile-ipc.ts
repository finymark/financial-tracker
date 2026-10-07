import type { IpcMain } from 'electron'
import { IPC_CHANNELS, type AppBridge } from '../../shared/ipc'
import type {
  CreateProfileInput,
  DeleteProfileInput,
  ProfileIdInput,
  RenameProfileInput,
  RestoreBackupInput,
} from '../../shared/profiles'
import type { ProfileController } from './profile-controller'

function inputRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('IPC input must be an object')
  }
  return value as Record<string, unknown>
}

function stringProperty(
  input: Record<string, unknown>,
  property: string,
): string {
  const value = input[property]
  if (typeof value !== 'string') {
    throw new TypeError(`IPC property ${property} must be a string`)
  }
  return value
}

function parseCreateProfileInput(value: unknown): CreateProfileInput {
  const input = inputRecord(value)
  return { name: stringProperty(input, 'name') }
}

function parseProfileIdInput(value: unknown): ProfileIdInput {
  const input = inputRecord(value)
  return { id: stringProperty(input, 'id') }
}

function parseRenameProfileInput(value: unknown): RenameProfileInput {
  const input = inputRecord(value)
  return {
    id: stringProperty(input, 'id'),
    name: stringProperty(input, 'name'),
  }
}

function parseDeleteProfileInput(value: unknown): DeleteProfileInput {
  const input = inputRecord(value)
  return {
    id: stringProperty(input, 'id'),
    confirmation: stringProperty(input, 'confirmation'),
  }
}

function parseRestoreBackupInput(value: unknown): RestoreBackupInput {
  const input = inputRecord(value)
  const confirmed = input['confirmed']
  if (typeof confirmed !== 'boolean') {
    throw new TypeError('IPC property confirmed must be a boolean')
  }
  return { backupId: stringProperty(input, 'backupId'), confirmed }
}

export function registerProfileIpc(
  ipcMain: IpcMain,
  controller: ProfileController,
): void {
  ipcMain.handle(
    IPC_CHANNELS.backupsList,
    (): Awaited<ReturnType<AppBridge['backups']['list']>> =>
      controller.listBackups(),
  )
  ipcMain.handle(
    IPC_CHANNELS.backupsRestore,
    async (
      _event,
      value: unknown,
    ): Promise<Awaited<ReturnType<AppBridge['backups']['restore']>>> =>
      controller.restoreBackup(parseRestoreBackupInput(value)),
  )
  ipcMain.handle(
    IPC_CHANNELS.profilesList,
    (): Awaited<ReturnType<AppBridge['profiles']['list']>> => controller.list(),
  )
  ipcMain.handle(
    IPC_CHANNELS.profilesCreate,
    async (
      _event,
      value: unknown,
    ): Promise<Awaited<ReturnType<AppBridge['profiles']['create']>>> => {
      const input = parseCreateProfileInput(value)
      return controller.create(input.name)
    },
  )
  ipcMain.handle(
    IPC_CHANNELS.profilesRename,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['profiles']['rename']>> => {
      const input = parseRenameProfileInput(value)
      return controller.rename(input.id, input.name)
    },
  )
  ipcMain.handle(
    IPC_CHANNELS.profilesDelete,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['profiles']['delete']>> => {
      const input = parseDeleteProfileInput(value)
      controller.delete(input.id, input.confirmation)
    },
  )
  ipcMain.handle(
    IPC_CHANNELS.profilesOpen,
    async (
      _event,
      value: unknown,
    ): Promise<Awaited<ReturnType<AppBridge['profiles']['open']>>> => {
      const input = parseProfileIdInput(value)
      return controller.open(input.id)
    },
  )
  ipcMain.handle(
    IPC_CHANNELS.profilesGetActive,
    (): Awaited<ReturnType<AppBridge['profiles']['getActive']>> =>
      controller.getActive(),
  )
  ipcMain.handle(
    IPC_CHANNELS.profilesClose,
    (): Awaited<ReturnType<AppBridge['profiles']['close']>> => {
      controller.close()
    },
  )
}
