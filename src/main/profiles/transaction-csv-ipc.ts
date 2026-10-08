import { BrowserWindow, dialog, type IpcMain } from 'electron'
import { writeFile } from 'node:fs/promises'
import { IPC_CHANNELS, type AppBridge } from '../../shared/ipc'
import { today } from '../../shared/date'
import { csvMessages } from '../../shared/csv-translations'
import { registerIpcHandler } from '../ipc'
import type { ProfileController } from './profile-controller'
import { parseTransactionCsvInput } from './transaction-csv-validation'

export function registerTransactionCsvIpc(
  ipcMain: IpcMain,
  controller: ProfileController,
): void {
  registerIpcHandler(
    ipcMain,
    IPC_CHANNELS.transactionsExportCsv,
    async (
      event,
      value,
    ): ReturnType<AppBridge['transactions']['exportCsv']> => {
      const input = parseTransactionCsvInput(value)
      const application = controller.getActiveApplication()
      const messages = csvMessages[application.queries.getSettings().language]
      const parent = BrowserWindow.fromWebContents(event.sender)
      if (!parent) throw new Error('CSV export requires the application window')
      // Capture the active profile's read snapshot before awaiting the native dialog.
      // The renderer can neither supply a filesystem path nor receive CSV contents.
      const content = application.queries.exportTransactionsCsv(input)
      const result = await dialog.showSaveDialog(parent, {
        title: messages['csv.export'],
        buttonLabel: messages['csv.save'],
        defaultPath: `transactions-${today(() => new Date())}.csv`,
        filters: [{ name: messages['csv.fileType'], extensions: ['csv'] }],
      })
      if (result.canceled || !result.filePath) return false
      await writeFile(result.filePath, content, 'utf8')
      return true
    },
  )
}
