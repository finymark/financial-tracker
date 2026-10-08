import type { IpcMain } from 'electron'
import { IPC_CHANNELS, type AppBridge } from '../../shared/ipc'
import {
  validateCategoryId,
  validateCategoryKind,
  validateCategoryName,
  validateCategoryParent,
  validateCategorySortOrder,
} from './category-validation'
import type { ProfileController } from './profile-controller'
import { inputRecord, registerIpcHandler } from '../ipc'

export function registerCategoryIpc(
  ipcMain: IpcMain,
  controller: ProfileController,
): void {
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.categoriesList,
    (): Awaited<ReturnType<AppBridge['categories']['list']>> =>
      controller.getActiveApplication().queries.listCategories(),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.categoriesListOptions,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['categories']['listOptions']>> => {
      const input = inputRecord(value)
      return controller
        .getActiveApplication()
        .queries.listCategoryOptions(validateCategoryKind(input.kind))
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.categoriesCreate,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['categories']['create']>> => {
      const input = inputRecord(value)
      return controller.getActiveApplication().commands.createCategory({
        name: validateCategoryName(input.name),
        kind: validateCategoryKind(input.kind),
        parentId: validateCategoryParent(input.parentId),
      })
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.categoriesRename,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['categories']['rename']>> => {
      const input = inputRecord(value)
      return controller.getActiveApplication().commands.renameCategory({
        id: validateCategoryId(input.id),
        name: validateCategoryName(input.name),
      })
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.categoriesReorder,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['categories']['reorder']>> => {
      const input = inputRecord(value)
      controller.getActiveApplication().commands.reorderCategory({
        id: validateCategoryId(input.id),
        sortOrder: validateCategorySortOrder(input.sortOrder),
      })
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.categoriesArchive,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['categories']['archive']>> => {
      controller
        .getActiveApplication()
        .commands.archiveCategory(validateCategoryId(inputRecord(value).id))
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.categoriesUnarchive,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['categories']['unarchive']>> => {
      controller
        .getActiveApplication()
        .commands.unarchiveCategory(validateCategoryId(inputRecord(value).id))
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.categoriesDelete,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['categories']['delete']>> => {
      const input = inputRecord(value)
      controller.getActiveApplication().commands.deleteCategory({
        id: validateCategoryId(input.id),
        ...(input.replacementId === undefined
          ? {}
          : { replacementId: validateCategoryId(input.replacementId) }),
      })
    },
  )
}
