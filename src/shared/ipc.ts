import type {
  CreateProfileInput,
  DeleteProfileInput,
  ProfileIdInput,
  ActiveProfileInfo,
  UpdateProfileSettingsInput,
  ProfileRegistrySnapshot,
  ProfileSummary,
  RenameProfileInput,
} from './profiles'
import type { ProfileSettings } from './settings'

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
  profilesUpdateSettings: 'profiles:update-settings',
} as const

export type DatabasePing = 'ok'

export interface AppBridge {
  getVersion(): Promise<string>
  dbPing(): Promise<DatabasePing>
  profiles: {
    list(): Promise<ProfileRegistrySnapshot>
    create(input: CreateProfileInput): Promise<ProfileSummary>
    rename(input: RenameProfileInput): Promise<ProfileSummary>
    delete(input: DeleteProfileInput): Promise<void>
    open(input: ProfileIdInput): Promise<ActiveProfileInfo>
    getActive(): Promise<ActiveProfileInfo | null>
    close(): Promise<void>
    updateSettings(input: UpdateProfileSettingsInput): Promise<ProfileSettings>
  }
}
