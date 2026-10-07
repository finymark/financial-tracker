import type {
  CreateProfileInput,
  DeleteProfileInput,
  ProfileBackup,
  ProfileIdInput,
  RestoreBackupInput,
  ProfileInfo,
  ProfileRegistrySnapshot,
  ProfileSummary,
  RenameProfileInput,
} from './profiles'

export const IPC_CHANNELS = {
  getVersion: 'app:getVersion',
  dbPing: 'db:ping',
  profilesList: 'profiles:list',
  profilesCreate: 'profiles:create',
  profilesRename: 'profiles:rename',
  profilesDelete: 'profiles:delete',
  profilesOpen: 'profiles:open',
  profilesGetActive: 'profiles:get-active',
  profilesClose: 'profiles:close',
  backupsList: 'backups:list',
  backupsRestore: 'backups:restore',
} as const

export type DatabasePing = 'ok'

export interface AppBridge {
  getVersion(): Promise<string>
  dbPing(): Promise<DatabasePing>
  backups: {
    list(): Promise<ProfileBackup[]>
    restore(input: RestoreBackupInput): Promise<ProfileInfo>
  }
  profiles: {
    list(): Promise<ProfileRegistrySnapshot>
    create(input: CreateProfileInput): Promise<ProfileSummary>
    rename(input: RenameProfileInput): Promise<ProfileSummary>
    delete(input: DeleteProfileInput): Promise<void>
    open(input: ProfileIdInput): Promise<ProfileInfo>
    getActive(): Promise<ProfileInfo | null>
    close(): Promise<void>
  }
}
