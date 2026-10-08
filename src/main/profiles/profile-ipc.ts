import { BrowserWindow, dialog, type IpcMain } from 'electron'
import { IPC_CHANNELS, type AppBridge } from '../../shared/ipc'
import type {
  CreateProfileInput,
  DeleteProfileInput,
  ProfileIdInput,
  RenameProfileInput,
  RestoreBackupInput,
  UpdateProfileSettingsInput,
} from '../../shared/profiles'
import type { ProfileController } from './profile-controller'
import { parseSettingsChanges } from './profile-settings'
import { inputRecord, registerIpcHandler } from '../ipc'

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

function parseUpdateSettingsInput(value: unknown): UpdateProfileSettingsInput {
  const input = inputRecord(value)
  return {
    id: stringProperty(input, 'id'),
    settings: parseSettingsChanges(input.settings),
  }
}

function parentWindow(
  event: Electron.IpcMainInvokeEvent,
): Electron.BrowserWindow {
  const parent = BrowserWindow.fromWebContents(event.sender)
  if (!parent) throw new Error('Folder picker requires the application window')
  return parent
}

export function registerProfileIpc(
  ipcMain: IpcMain,
  controller: ProfileController,
  onProfileNeedsRateRefresh: () => void = () => {},
  onProfileClosed: () => void = () => {},
  onProfilePresentationChanged: () => void = () => {},
  beforeActiveProfileChange: () => Promise<void> = () => Promise.resolve(),
): void {
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.backupsList,
    (): Awaited<ReturnType<AppBridge['backups']['list']>> =>
      controller.listBackups(),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.backupsRestore,
    async (
      _event,
      value: unknown,
    ): Promise<Awaited<ReturnType<AppBridge['backups']['restore']>>> => {
      await beforeActiveProfileChange()
      const restored = await controller.restoreBackup(
        parseRestoreBackupInput(value),
      )
      onProfilePresentationChanged()
      return restored
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.profilesList,
    (): Awaited<ReturnType<AppBridge['profiles']['list']>> => controller.list(),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.profilesCreate,
    async (
      _event,
      value: unknown,
    ): Promise<Awaited<ReturnType<AppBridge['profiles']['create']>>> => {
      const input = parseCreateProfileInput(value)
      return controller.create(input.name)
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.profilesRename,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['profiles']['rename']>> => {
      const input = parseRenameProfileInput(value)
      const renamed = controller.rename(input.id, input.name)
      if (controller.getActive()?.id === input.id)
        onProfilePresentationChanged()
      return renamed
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.profilesDelete,
    async (_event, value: unknown): Promise<void> => {
      const input = parseDeleteProfileInput(value)
      const deletesActiveProfile = controller.getActive()?.id === input.id
      if (deletesActiveProfile) await beforeActiveProfileChange()
      await controller.delete(input.id, input.confirmation)
      if (deletesActiveProfile) {
        onProfileClosed()
        onProfilePresentationChanged()
      }
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.profilesOpen,
    async (
      _event,
      value: unknown,
    ): Promise<Awaited<ReturnType<AppBridge['profiles']['open']>>> => {
      const input = parseProfileIdInput(value)
      if (controller.getActive()) await beforeActiveProfileChange()
      const opened = await controller.open(input.id)
      onProfileNeedsRateRefresh()
      onProfilePresentationChanged()
      return opened
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.profilesGetActive,
    (): Awaited<ReturnType<AppBridge['profiles']['getActive']>> =>
      controller.getActive(),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.profilesUpdateSettings,
    async (
      _event,
      value: unknown,
    ): Promise<
      Awaited<ReturnType<AppBridge['profiles']['updateSettings']>>
    > => {
      const input = parseUpdateSettingsInput(value)
      const settings = await controller.updateSettings(input)
      if (input.settings.language || input.settings.theme)
        onProfilePresentationChanged()
      if (input.settings.baseCurrency) onProfileNeedsRateRefresh()
      return settings
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.profilesPickWatchedFolder,
    async (event): ReturnType<AppBridge['profiles']['pickWatchedFolder']> => {
      if (!controller.getActive()) throw new Error('No profile is open')
      const result = await dialog.showOpenDialog(parentWindow(event), {
        properties: ['openDirectory'],
      })
      return result.canceled ? null : (result.filePaths[0] ?? null)
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.profilesWatchedFolderStatus,
    (): Awaited<ReturnType<AppBridge['profiles']['watchedFolderStatus']>> =>
      controller.getWatchedFolderStatus(),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.profilesClose,
    async (): Promise<void> => {
      if (controller.getActive()) await beforeActiveProfileChange()
      await controller.close()
      onProfileClosed()
      onProfilePresentationChanged()
    },
  )
}
