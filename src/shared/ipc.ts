import type {
  Account,
  AccountIdInput,
  CreateAccountInput,
  RenameAccountInput,
  ChangeAccountCurrencyInput,
} from './accounts'
import type {
  CreateProfileInput,
  DeleteProfileInput,
  ProfileIdInput,
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
  accountsList: 'accounts:list',
  accountsListOptions: 'accounts:list-options',
  accountsCreate: 'accounts:create',
  accountsRename: 'accounts:rename',
  accountsChangeCurrency: 'accounts:change-currency',
  accountsArchive: 'accounts:archive',
  accountsDelete: 'accounts:delete',
} as const

export type DatabasePing = 'ok'

export interface AppBridge {
  getVersion(): Promise<string>
  dbPing(): Promise<DatabasePing>
  accounts: {
    list(): Promise<Account[]>
    listOptions(): Promise<Account[]>
    create(input: CreateAccountInput): Promise<Account>
    rename(input: RenameAccountInput): Promise<Account>
    changeCurrency(input: ChangeAccountCurrencyInput): Promise<Account>
    archive(input: AccountIdInput): Promise<void>
    delete(input: AccountIdInput): Promise<void>
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
