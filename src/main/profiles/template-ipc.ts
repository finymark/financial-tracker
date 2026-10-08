import type { IpcMain } from 'electron'
import { IPC_CHANNELS, type AppBridge } from '../../shared/ipc'
import { inputRecord, registerIpcHandler } from '../ipc'
import type { ProfileController } from './profile-controller'
import {
  templateFields,
  validateTemplateId,
  validateTemplateName,
} from './template-validation'
import { validateTransactionId } from './transaction-validation'

export function registerTemplateIpc(
  ipcMain: IpcMain,
  controller: ProfileController,
): void {
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.templatesList,
    (): Awaited<ReturnType<AppBridge['templates']['list']>> =>
      controller.getActiveApplication().queries.listTemplates(),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.templatesCreate,
    (_event, value): Awaited<ReturnType<AppBridge['templates']['create']>> =>
      controller
        .getActiveApplication()
        .commands.createTemplate(templateFields(inputRecord(value))),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.templatesUpdate,
    (_event, value): Awaited<ReturnType<AppBridge['templates']['update']>> => {
      const input = inputRecord(value)
      return controller.getActiveApplication().commands.updateTemplate({
        id: validateTemplateId(input.id),
        ...templateFields(input),
      })
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.templatesDelete,
    (_event, value): Awaited<ReturnType<AppBridge['templates']['delete']>> => {
      controller
        .getActiveApplication()
        .commands.deleteTemplate(validateTemplateId(inputRecord(value).id))
    },
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.templatesSaveTransaction,
    (
      _event,
      value,
    ): Awaited<ReturnType<AppBridge['templates']['saveTransaction']>> => {
      const input = inputRecord(value)
      return controller
        .getActiveApplication()
        .commands.saveTransactionAsTemplate({
          transactionId: validateTransactionId(input.transactionId),
          name: validateTemplateName(input.name),
        })
    },
  )
}
