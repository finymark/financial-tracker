import type { IpcMain } from 'electron'
import { IPC_CHANNELS, type AppBridge } from '../../shared/ipc'
import { inputRecord, registerIpcHandler } from '../ipc'
import type { ProfileController } from './profile-controller'
import {
  parseCategorisationRuleDraftInput,
  parseCategorisationRuleInput,
  parseReorderCategorisationRuleInput,
  parseUpdateCategorisationRuleInput,
  validateCategorisationRuleId,
} from './rule-validation'

export function registerCategorisationRuleIpc(
  ipcMain: IpcMain,
  controller: ProfileController,
): void {
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.rulesList,
    (): Awaited<ReturnType<AppBridge['rules']['list']>> =>
      controller.getActiveApplication().queries.listCategorisationRules(),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.rulesAutofill,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['rules']['autofill']>> =>
      controller
        .getActiveApplication()
        .queries.getCategorisationAutofill(
          parseCategorisationRuleDraftInput(value),
        ),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.rulesCreate,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['rules']['create']>> =>
      controller
        .getActiveApplication()
        .commands.createCategorisationRule(parseCategorisationRuleInput(value)),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.rulesUpdate,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['rules']['update']>> =>
      controller
        .getActiveApplication()
        .commands.updateCategorisationRule(
          parseUpdateCategorisationRuleInput(value),
        ),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.rulesReorder,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['rules']['reorder']>> =>
      controller
        .getActiveApplication()
        .commands.reorderCategorisationRule(
          parseReorderCategorisationRuleInput(value),
        ),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.rulesDelete,
    (
      _event,
      value: unknown,
    ): Awaited<ReturnType<AppBridge['rules']['delete']>> =>
      controller
        .getActiveApplication()
        .commands.deleteCategorisationRule(
          validateCategorisationRuleId(inputRecord(value).id),
        ),
  )
}
