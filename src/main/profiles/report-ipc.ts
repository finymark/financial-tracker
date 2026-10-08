import type { IpcMain } from 'electron'
import { IPC_CHANNELS, type AppBridge } from '../../shared/ipc'
import { registerIpcHandler } from '../ipc'
import type { ProfileController } from './profile-controller'
import { parseReportDateRangeInput } from './report-validation'

export function registerReportIpc(
  ipcMain: IpcMain,
  controller: ProfileController,
): void {
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.reportsMonthlyTrend,
    (
      _event,
      value,
    ): Awaited<ReturnType<AppBridge['reports']['monthlyTrend']>> =>
      controller
        .getActiveApplication()
        .queries.getMonthlyTrend(parseReportDateRangeInput(value)),
  )
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.reportsCategoryBreakdown,
    (
      _event,
      value,
    ): Awaited<ReturnType<AppBridge['reports']['categoryBreakdown']>> =>
      controller
        .getActiveApplication()
        .queries.getCategoryBreakdown(parseReportDateRangeInput(value)),
  )
}
