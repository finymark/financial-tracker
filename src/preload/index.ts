import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type AppBridge } from '../shared/ipc'

const bridge: AppBridge = {
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
    listOptions: () => ipcRenderer.invoke(IPC_CHANNELS.accountsListOptions),
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
    updateSettings: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.profilesUpdateSettings, input),
  },
}

contextBridge.exposeInMainWorld('app', bridge)
