import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type AppBridge } from '../shared/ipc'

const bridge: AppBridge = {
  getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.getVersion),
  dbPing: () => ipcRenderer.invoke(IPC_CHANNELS.dbPing),
}

contextBridge.exposeInMainWorld('app', bridge)
