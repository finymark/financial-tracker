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
    IPC_CHANNELS.reportsOverviewDashboard,
    (): Awaited<ReturnType<AppBridge['reports']['overviewDashboard']>> =>
      controller.getActiveApplication().queries.getOverviewDashboard(),
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
