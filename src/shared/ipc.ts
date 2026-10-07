export const IPC_CHANNELS = {
  getVersion: 'app:getVersion',
  dbPing: 'db:ping',
} as const

export type DatabasePing = 'ok'

export interface AppBridge {
  getVersion(): Promise<string>
  dbPing(): Promise<DatabasePing>
}
