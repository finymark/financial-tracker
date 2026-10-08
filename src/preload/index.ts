import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC_CHANNELS, type AppBridge } from '../shared/ipc'
import type {
  WatchedFolderFailure,
  WatchedFolderStatus,
} from '../shared/settings'

const bridge: AppBridge = {
  phoneUpload: {
    start: (input) => ipcRenderer.invoke(IPC_CHANNELS.phoneUploadStart, input),
    stop: (input) => ipcRenderer.invoke(IPC_CHANNELS.phoneUploadStop, input),
    onReceived: (listener) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        received: Parameters<typeof listener>[0],
      ) => listener(received)
      ipcRenderer.on(IPC_CHANNELS.phoneUploadReceived, handler)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.phoneUploadReceived, handler)
    },
  },
  files: {
    path: (file) => webUtils.getPathForFile(file),
  },
  attachments: {
    pick: () => ipcRenderer.invoke(IPC_CHANNELS.attachmentsPick),
    pickCopyFolder: () =>
      ipcRenderer.invoke(IPC_CHANNELS.attachmentsPickCopyFolder),
    import: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.attachmentsImport, input),
    list: (input) => ipcRenderer.invoke(IPC_CHANNELS.attachmentsList, input),
    attach: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.attachmentsAttach, input),
    remove: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.attachmentsRemove, input),
    open: (input) => ipcRenderer.invoke(IPC_CHANNELS.attachmentsOpen, input),
  },
  receipts: {
    intake: (input) => ipcRenderer.invoke(IPC_CHANNELS.receiptsIntake, input),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.receiptsList),
    count: () => ipcRenderer.invoke(IPC_CHANNELS.receiptsCount),
    defaultAccountId: () =>
      ipcRenderer.invoke(IPC_CHANNELS.receiptsDefaultAccount),
    confirm: (input) => ipcRenderer.invoke(IPC_CHANNELS.receiptsConfirm, input),
    discard: (input) => ipcRenderer.invoke(IPC_CHANNELS.receiptsDiscard, input),
    preview: (input) => ipcRenderer.invoke(IPC_CHANNELS.receiptsPreview, input),
    onChanged: (listener) => {
      const handler = () => listener()
      ipcRenderer.on(IPC_CHANNELS.receiptsChanged, handler)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.receiptsChanged, handler)
    },
  },
  desktop: {
    autostartStatus: () =>
      ipcRenderer.invoke(IPC_CHANNELS.desktopAutostartStatus),
    setAutostart: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.desktopSetAutostart, input),
    shortcutStatus: () =>
      ipcRenderer.invoke(IPC_CHANNELS.desktopShortcutStatus),
    setShortcut: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.desktopSetShortcut, input),
    showMain: () => ipcRenderer.invoke(IPC_CHANNELS.desktopShowMain),
    closeQuickAdd: () => ipcRenderer.invoke(IPC_CHANNELS.desktopCloseQuickAdd),
    quickAddSaved: () => ipcRenderer.invoke(IPC_CHANNELS.desktopQuickAddSaved),
    onDataChanged: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, offerUndo: boolean) =>
        listener(offerUndo)
      ipcRenderer.on(IPC_CHANNELS.desktopDataChanged, handler)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.desktopDataChanged, handler)
    },
    onProfileChanged: (listener) => {
      const handler = () => listener()
      ipcRenderer.on(IPC_CHANNELS.desktopProfileChanged, handler)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.desktopProfileChanged, handler)
    },
  },
  recurring: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.recurringList),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.recurringCreate, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.recurringUpdate, input),
    pause: (input) => ipcRenderer.invoke(IPC_CHANNELS.recurringPause, input),
    resume: (input) => ipcRenderer.invoke(IPC_CHANNELS.recurringResume, input),
    delete: (input) => ipcRenderer.invoke(IPC_CHANNELS.recurringDelete, input),
    pending: () => ipcRenderer.invoke(IPC_CHANNELS.pendingList),
    dueCount: () => ipcRenderer.invoke(IPC_CHANNELS.pendingDueCount),
    confirm: (input) => ipcRenderer.invoke(IPC_CHANNELS.pendingConfirm, input),
    skip: (input) => ipcRenderer.invoke(IPC_CHANNELS.pendingSkip, input),
    onPendingChanged: (listener) => {
      const handler = () => listener()
      ipcRenderer.on(IPC_CHANNELS.pendingChanged, handler)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.pendingChanged, handler)
    },
  },
  reports: {
    cashFlow: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.reportsCashFlow, input),
    spendingPace: () => ipcRenderer.invoke(IPC_CHANNELS.reportsSpendingPace),
    overviewDashboard: () =>
      ipcRenderer.invoke(IPC_CHANNELS.reportsOverviewDashboard),
    monthlyTrend: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.reportsMonthlyTrend, input),
    categoryBreakdown: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.reportsCategoryBreakdown, input),
  },
  rates: {
    status: () => ipcRenderer.invoke(IPC_CHANNELS.ratesStatus),
    onStatusChanged: (listener) => {
      const handler = () => listener()
      ipcRenderer.on(IPC_CHANNELS.ratesStatusChanged, handler)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.ratesStatusChanged, handler)
    },
  },
  rules: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.rulesList),
    autofill: (input) => ipcRenderer.invoke(IPC_CHANNELS.rulesAutofill, input),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.rulesCreate, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.rulesUpdate, input),
    reorder: (input) => ipcRenderer.invoke(IPC_CHANNELS.rulesReorder, input),
    delete: (input) => ipcRenderer.invoke(IPC_CHANNELS.rulesDelete, input),
  },
  updates: {
    isReady: () => ipcRenderer.invoke(IPC_CHANNELS.updatesIsReady),
    onReady: (listener) => {
      const handler = () => listener()
      ipcRenderer.on(IPC_CHANNELS.updatesReady, handler)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.updatesReady, handler)
    },
    restart: () => ipcRenderer.invoke(IPC_CHANNELS.updatesRestart),
  },
  getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.getVersion),
  templates: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.templatesList),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.templatesCreate, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.templatesUpdate, input),
    delete: (input) => ipcRenderer.invoke(IPC_CHANNELS.templatesDelete, input),
    saveTransaction: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.templatesSaveTransaction, input),
  },
  transactions: {
    exportCsv: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.transactionsExportCsv, input),
    duplicate: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.transactionsDuplicate, input),
    list: (input) => ipcRenderer.invoke(IPC_CHANNELS.transactionsList, input),
    create: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.transactionsCreate, input),
    update: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.transactionsUpdate, input),
    delete: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.transactionsDelete, input),
  },
  transfers: {
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.transfersCreate, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.transfersUpdate, input),
    delete: (input) => ipcRenderer.invoke(IPC_CHANNELS.transfersDelete, input),
  },
  adjustments: {
    create: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.adjustmentsCreate, input),
    update: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.adjustmentsUpdate, input),
    delete: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.adjustmentsDelete, input),
  },
  undo: {
    last: () => ipcRenderer.invoke(IPC_CHANNELS.undoLast),
  },
  tags: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.tagsList),
    rename: (input) => ipcRenderer.invoke(IPC_CHANNELS.tagsRename, input),
    delete: (input) => ipcRenderer.invoke(IPC_CHANNELS.tagsDelete, input),
  },
  payees: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.payeesList),
    suggest: (input) => ipcRenderer.invoke(IPC_CHANNELS.payeesSuggest, input),
    listAliases: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.payeeAliasesList, input),
    addAlias: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.payeeAliasesAdd, input),
    removeAlias: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.payeeAliasesRemove, input),
    merge: (input) => ipcRenderer.invoke(IPC_CHANNELS.payeesMerge, input),
  },
  backups: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.backupsList),
    restore: (input) => ipcRenderer.invoke(IPC_CHANNELS.backupsRestore, input),
  },
  categories: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.categoriesList),
    listOptions: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.categoriesListOptions, input),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.categoriesCreate, input),
    rename: (input) => ipcRenderer.invoke(IPC_CHANNELS.categoriesRename, input),
    reorder: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.categoriesReorder, input),
    archive: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.categoriesArchive, input),
    unarchive: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.categoriesUnarchive, input),
    delete: (input) => ipcRenderer.invoke(IPC_CHANNELS.categoriesDelete, input),
  },
  accounts: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.accountsList),
    listOptions: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.accountsListOptions, input),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.accountsCreate, input),
    rename: (input) => ipcRenderer.invoke(IPC_CHANNELS.accountsRename, input),
    changeCurrency: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.accountsChangeCurrency, input),
    archive: (input) => ipcRenderer.invoke(IPC_CHANNELS.accountsArchive, input),
    unarchive: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.accountsUnarchive, input),
    delete: (input) => ipcRenderer.invoke(IPC_CHANNELS.accountsDelete, input),
  },
  profiles: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.profilesList),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.profilesCreate, input),
    rename: (input) => ipcRenderer.invoke(IPC_CHANNELS.profilesRename, input),
    delete: (input) => ipcRenderer.invoke(IPC_CHANNELS.profilesDelete, input),
    open: (input) => ipcRenderer.invoke(IPC_CHANNELS.profilesOpen, input),
    getActive: () => ipcRenderer.invoke(IPC_CHANNELS.profilesGetActive),
    close: () => ipcRenderer.invoke(IPC_CHANNELS.profilesClose),
    pickWatchedFolder: () =>
      ipcRenderer.invoke(IPC_CHANNELS.profilesPickWatchedFolder),
    watchedFolderStatus: () =>
      ipcRenderer.invoke(IPC_CHANNELS.profilesWatchedFolderStatus),
    onWatchedFolderStatusChanged: (listener) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        status: WatchedFolderStatus | null,
      ) => listener(status)
      ipcRenderer.on(IPC_CHANNELS.profilesWatchedFolderStatusChanged, handler)
      return () =>
        ipcRenderer.removeListener(
          IPC_CHANNELS.profilesWatchedFolderStatusChanged,
          handler,
        )
    },
    onWatchedFolderFailure: (listener) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        failure: WatchedFolderFailure,
      ) => listener(failure)
      ipcRenderer.on(IPC_CHANNELS.profilesWatchedFolderFailure, handler)
      return () =>
        ipcRenderer.removeListener(
          IPC_CHANNELS.profilesWatchedFolderFailure,
          handler,
        )
    },
    updateSettings: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.profilesUpdateSettings, input),
  },
}

contextBridge.exposeInMainWorld('app', bridge)
