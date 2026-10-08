import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type AppBridge } from '../shared/ipc'

const bridge: AppBridge = {
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
  dbPing: () => ipcRenderer.invoke(IPC_CHANNELS.dbPing),
  transactions: {
    list: (input) => ipcRenderer.invoke(IPC_CHANNELS.transactionsList, input),
    create: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.transactionsCreate, input),
    update: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.transactionsUpdate, input),
    delete: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.transactionsDelete, input),
  },
  payees: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.payeesList),
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
