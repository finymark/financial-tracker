import type {
  Category,
  CategoryIdInput,
  CategoryOptionsInput,
  CreateCategoryInput,
  RenameCategoryInput,
  ReorderCategoryInput,
  DeleteCategoryInput,
} from './categories'
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
  ProfileBackup,
  ProfileIdInput,
  RestoreBackupInput,
  ActiveProfileInfo,
  UpdateProfileSettingsInput,
  ProfileRegistrySnapshot,
  ProfileSummary,
  RenameProfileInput,
} from './profiles'
import type { ProfileSettings } from './settings'
import type {
  CreateTransactionInput,
  Payee,
  TransactionListInput,
  TransactionPage,
  Transaction,
  TransactionIdInput,
  UpdateTransactionInput,
} from './transactions'
import type {
  CreateTransferInput,
  Transfer,
  TransferIdInput,
  UpdateTransferInput,
} from './transfers'
import type {
  BalanceAdjustment,
  BalanceAdjustmentIdInput,
  CreateBalanceAdjustmentInput,
  UpdateBalanceAdjustmentInput,
} from './adjustments'

export const IPC_CHANNELS = {
  getVersion: 'app:getVersion',
  updatesIsReady: 'updates:is-ready',
  updatesReady: 'updates:ready',
  updatesRestart: 'updates:restart',
  profilesList: 'profiles:list',
  profilesCreate: 'profiles:create',
  profilesRename: 'profiles:rename',
  profilesDelete: 'profiles:delete',
  profilesOpen: 'profiles:open',
  profilesGetActive: 'profiles:get-active',
  profilesClose: 'profiles:close',
  backupsList: 'backups:list',
  backupsRestore: 'backups:restore',
  categoriesList: 'categories:list',
  categoriesListOptions: 'categories:list-options',
  categoriesCreate: 'categories:create',
  categoriesRename: 'categories:rename',
  categoriesReorder: 'categories:reorder',
  categoriesArchive: 'categories:archive',
  categoriesUnarchive: 'categories:unarchive',
  categoriesDelete: 'categories:delete',
  accountsList: 'accounts:list',
  accountsListOptions: 'accounts:list-options',
  accountsCreate: 'accounts:create',
  accountsRename: 'accounts:rename',
  accountsChangeCurrency: 'accounts:change-currency',
  accountsArchive: 'accounts:archive',
  accountsDelete: 'accounts:delete',
  profilesUpdateSettings: 'profiles:update-settings',
  transactionsList: 'transactions:list',
  transactionsCreate: 'transactions:create',
  transactionsUpdate: 'transactions:update',
  transactionsDelete: 'transactions:delete',
  transfersCreate: 'transfers:create',
  transfersUpdate: 'transfers:update',
  transfersDelete: 'transfers:delete',
  adjustmentsCreate: 'adjustments:create',
  adjustmentsUpdate: 'adjustments:update',
  adjustmentsDelete: 'adjustments:delete',
  undoLast: 'undo:last',
  payeesList: 'payees:list',
} as const

export interface AppBridge {
  updates: {
    isReady(): Promise<boolean>
    onReady(listener: () => void): () => void
    restart(): Promise<void>
  }
  getVersion(): Promise<string>
  transactions: {
    list(input?: TransactionListInput): Promise<TransactionPage>
    create(input: CreateTransactionInput): Promise<Transaction>
    update(input: UpdateTransactionInput): Promise<Transaction>
    delete(input: TransactionIdInput): Promise<void>
  }
  transfers: {
    create(input: CreateTransferInput): Promise<Transfer>
    update(input: UpdateTransferInput): Promise<Transfer>
    delete(input: TransferIdInput): Promise<void>
  }
  adjustments: {
    create(input: CreateBalanceAdjustmentInput): Promise<BalanceAdjustment>
    update(input: UpdateBalanceAdjustmentInput): Promise<BalanceAdjustment>
    delete(input: BalanceAdjustmentIdInput): Promise<void>
  }
  undo: {
    last(): Promise<boolean>
  }
  payees: {
    list(): Promise<Payee[]>
  }
  backups: {
    list(): Promise<ProfileBackup[]>
    restore(input: RestoreBackupInput): Promise<ActiveProfileInfo>
  }
  categories: {
    list(): Promise<Category[]>
    listOptions(input: CategoryOptionsInput): Promise<Category[]>
    create(input: CreateCategoryInput): Promise<Category>
    rename(input: RenameCategoryInput): Promise<Category>
    reorder(input: ReorderCategoryInput): Promise<void>
    archive(input: CategoryIdInput): Promise<void>
    unarchive(input: CategoryIdInput): Promise<void>
    delete(input: DeleteCategoryInput): Promise<void>
  }
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
    open(input: ProfileIdInput): Promise<ActiveProfileInfo>
    getActive(): Promise<ActiveProfileInfo | null>
    close(): Promise<void>
    updateSettings(input: UpdateProfileSettingsInput): Promise<ProfileSettings>
  }
}
