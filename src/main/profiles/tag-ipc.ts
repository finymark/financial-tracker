import type { IpcMain } from 'electron'
import { IPC_CHANNELS, type AppBridge } from '../../shared/ipc'
import { inputRecord, registerIpcHandler } from '../ipc'
import type { ProfileController } from './profile-controller'
import { validateTagId, validateTagName } from './tag-validation'

export function registerTagIpc(
  ipcMain: IpcMain,
  controller: ProfileController,
): void {
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.tagsList,
    (): Awaited<ReturnType<AppBridge['tags']['list']>> =>
      controller.getActiveApplication().queries.listTags(),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.tagsRename,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['tags']['rename']>> => {
      const input = inputRecord(value)
      return controller.getActiveApplication().commands.renameTag({
        id: validateTagId(input.id),
        name: validateTagName(input.name),
      })
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.tagsDelete,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['tags']['delete']>> => {
      controller
        .getActiveApplication()
        .commands.deleteTag(validateTagId(inputRecord(value).id))
    },
  )
}
