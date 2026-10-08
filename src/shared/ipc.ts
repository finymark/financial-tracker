import type {
  AutostartStatus,
  SetAutostartInput,
  SetQuickAddShortcutInput,
  ShortcutStatus,
} from './desktop'
import type { TransactionCsvInput } from './transaction-csv'
import type {
  CreateTemplateInput,
  UpdateTemplateInput,
  TransactionTemplate,
  TemplateIdInput,
  SaveTransactionAsTemplateInput,
} from './templates'
import type { Tag, TagIdInput, RenameTagInput } from './tags'
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
  AccountOption,
  ListAccountOptionsInput,
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
import type {
  ProfileSettings,
  WatchedFolderFailure,
  WatchedFolderStatus,
} from './settings'
import type {
  CreateTransactionInput,
  TransactionListInput,
  TransactionPage,
  Transaction,
  TransactionIdInput,
  UpdateTransactionInput,
  DeleteTransactionInput,
} from './transactions'
import type {
  Attachment,
  AttachmentIdInput,
  AttachmentTransactionInput,
  AttachAttachmentInput,
  ImportAttachmentInput,
  OpenAttachmentInput,
  StagedAttachment,
} from './attachments'
import type {
  CreateTransferInput,
  Transfer,
  TransferIdInput,
  UpdateTransferInput,
} from './transfers'
import type {
  AddPayeeAliasInput,
  MergePayeesInput,
  Payee,
  PayeeAlias,
  PayeeAliasIdInput,
  PayeeAliasesInput,
  PayeeSuggestion,
  PayeeSuggestionInput,
} from './payees'
import type {
  BalanceAdjustment,
  BalanceAdjustmentIdInput,
  CreateBalanceAdjustmentInput,
  UpdateBalanceAdjustmentInput,
} from './adjustments'
import type {
  CategorisationAutofill,
  CategorisationRule,
  CategorisationRuleDraftInput,
  CategorisationRuleIdInput,
  CreateCategorisationRuleInput,
  ReorderCategorisationRuleInput,
  UpdateCategorisationRuleInput,
} from './rules'
import type { RateStatus } from './exchange-rates'
import type { CashFlowReport } from './report-cash-flow'
import type { OverviewDashboard } from './report-overview'
import type {
  CategoryBreakdownReport,
  MonthlyTrendReport,
  ReportDateRangeInput,
  SpendingPaceReport,
} from './reports'
import type {
  CreateRecurringTransactionInput,
  ConfirmPendingTransactionInput,
  PendingTransaction,
  RecurringTransaction,
  RecurringTransactionIdInput,
  UpdateRecurringTransactionInput,
} from './recurring'
import type {
  PhoneUploadReceivedEvent,
  PhoneUploadStartInput,
  PhoneUploadStartResult,
  PhoneUploadStopInput,
} from './phone-upload'
import type {
  ConfirmReceiptInput,
  ConfirmedReceipt,
  IntakeReceiptInput,
  Receipt,
  ReceiptIdInput,
  ReceiptPrefill,
  ReceiptPreviewInput,
} from './receipts'
import type { ResolvedTheme } from './window-chrome'

export const IPC_CHANNELS = {
  getVersion: 'app:getVersion',
  desktopAutostartStatus: 'desktop:autostart-status',
  desktopSetAutostart: 'desktop:set-autostart',
  desktopShortcutStatus: 'desktop:shortcut-status',
  desktopSetShortcut: 'desktop:set-shortcut',
  desktopShowMain: 'desktop:show-main',
  desktopCloseQuickAdd: 'desktop:close-quick-add',
  desktopQuickAddSaved: 'desktop:quick-add-saved',
  desktopDataChanged: 'desktop:data-changed',
  desktopProfileChanged: 'desktop:profile-changed',
  windowChromeSetTheme: 'window-chrome:set-theme',
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
  profilesPickWatchedFolder: 'profiles:pick-watched-folder',
  profilesWatchedFolderStatus: 'profiles:watched-folder-status',
  profilesWatchedFolderStatusChanged: 'profiles:watched-folder-status-changed',
  profilesWatchedFolderFailure: 'profiles:watched-folder-failure',
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
  accountsUnarchive: 'accounts:unarchive',
  accountsDelete: 'accounts:delete',
  profilesUpdateSettings: 'profiles:update-settings',
  templatesList: 'templates:list',
  templatesCreate: 'templates:create',
  templatesUpdate: 'templates:update',
  templatesDelete: 'templates:delete',
  templatesSaveTransaction: 'templates:save-transaction',
  transactionsDuplicate: 'transactions:duplicate',
  transactionsList: 'transactions:list',
  transactionsExportCsv: 'transactions:export-csv',
  transactionsCreate: 'transactions:create',
  transactionsUpdate: 'transactions:update',
  transactionsDelete: 'transactions:delete',
  attachmentsPick: 'attachments:pick',
  attachmentsPickCopyFolder: 'attachments:pick-copy-folder',
  attachmentsImport: 'attachments:import',
  attachmentsList: 'attachments:list',
  attachmentsAttach: 'attachments:attach',
  attachmentsRemove: 'attachments:remove',
  attachmentsOpen: 'attachments:open',
  transfersCreate: 'transfers:create',
  transfersUpdate: 'transfers:update',
  transfersDelete: 'transfers:delete',
  adjustmentsCreate: 'adjustments:create',
  adjustmentsUpdate: 'adjustments:update',
  adjustmentsDelete: 'adjustments:delete',
  undoLast: 'undo:last',
  payeesList: 'payees:list',
  payeesSuggest: 'payees:suggest',
  payeeAliasesList: 'payee-aliases:list',
  payeeAliasesAdd: 'payee-aliases:add',
  payeeAliasesRemove: 'payee-aliases:remove',
  payeesMerge: 'payees:merge',
  tagsList: 'tags:list',
  tagsRename: 'tags:rename',
  tagsDelete: 'tags:delete',
  rulesList: 'rules:list',
  rulesAutofill: 'rules:autofill',
  rulesCreate: 'rules:create',
  rulesUpdate: 'rules:update',
  rulesReorder: 'rules:reorder',
  rulesDelete: 'rules:delete',
  ratesStatus: 'rates:status',
  ratesStatusChanged: 'rates:status-changed',
  reportsCategoryBreakdown: 'reports:category-breakdown',
  reportsCashFlow: 'reports:cash-flow',
  reportsSpendingPace: 'reports:spending-pace',
  reportsOverviewDashboard: 'reports:overview-dashboard',
  reportsMonthlyTrend: 'reports:monthly-trend',
  recurringList: 'recurring:list',
  recurringCreate: 'recurring:create',
  recurringUpdate: 'recurring:update',
  recurringPause: 'recurring:pause',
  recurringResume: 'recurring:resume',
  recurringDelete: 'recurring:delete',
  pendingList: 'pending:list',
  pendingDueCount: 'pending:due-count',
  pendingConfirm: 'pending:confirm',
  pendingSkip: 'pending:skip',
  pendingChanged: 'pending:changed',
  phoneUploadStart: 'phone-upload:start',
  phoneUploadStop: 'phone-upload:stop',
  phoneUploadReceived: 'phone-upload:received',
  receiptsIntake: 'receipts:intake',
  receiptsList: 'receipts:list',
  receiptsCount: 'receipts:count',
  receiptsDefaultAccount: 'receipts:default-account',
  receiptsPrefill: 'receipts:prefill',
  receiptsConfirm: 'receipts:confirm',
  receiptsDiscard: 'receipts:discard',
  receiptsPreview: 'receipts:preview',
  receiptsChanged: 'receipts:changed',
} as const

export interface AppBridge {
  windowChrome: {
    setTheme(theme: ResolvedTheme): Promise<void>
  }
  phoneUpload: {
    start(input: PhoneUploadStartInput): Promise<PhoneUploadStartResult>
    stop(input: PhoneUploadStopInput): Promise<void>
    onReceived(listener: (event: PhoneUploadReceivedEvent) => void): () => void
  }
  files: {
    path(file: File): string
  }
  attachments: {
    pick(): Promise<string[]>
    pickCopyFolder(): Promise<string | null>
    import(input: ImportAttachmentInput): Promise<StagedAttachment>
    list(input: AttachmentTransactionInput): Promise<Attachment[]>
    attach(input: AttachAttachmentInput): Promise<Attachment>
    remove(input: AttachmentIdInput): Promise<void>
    open(input: OpenAttachmentInput): Promise<void>
  }
  receipts: {
    intake(input: IntakeReceiptInput): Promise<Receipt>
    list(): Promise<Receipt[]>
    count(): Promise<number>
    defaultAccountId(): Promise<string | null>
    prefill(input: ReceiptIdInput): Promise<ReceiptPrefill>
    confirm(input: ConfirmReceiptInput): Promise<ConfirmedReceipt>
    discard(input: ReceiptIdInput): Promise<Receipt>
    preview(input: ReceiptPreviewInput): Promise<string>
    onChanged(listener: () => void): () => void
  }
  desktop: {
    autostartStatus(): Promise<AutostartStatus>
    setAutostart(input: SetAutostartInput): Promise<AutostartStatus>
    shortcutStatus(): Promise<ShortcutStatus>
    setShortcut(input: SetQuickAddShortcutInput): Promise<ShortcutStatus>
    showMain(): Promise<void>
    closeQuickAdd(): Promise<void>
    quickAddSaved(): Promise<void>
    onDataChanged(listener: (offerUndo: boolean) => void): () => void
    onProfileChanged(listener: () => void): () => void
  }
  recurring: {
    list(): Promise<RecurringTransaction[]>
    create(
      input: CreateRecurringTransactionInput,
    ): Promise<RecurringTransaction>
    update(
      input: UpdateRecurringTransactionInput,
    ): Promise<RecurringTransaction>
    pause(input: RecurringTransactionIdInput): Promise<void>
    resume(input: RecurringTransactionIdInput): Promise<void>
    delete(input: RecurringTransactionIdInput): Promise<void>
    pending(): Promise<PendingTransaction[]>
    dueCount(): Promise<number>
    confirm(input: ConfirmPendingTransactionInput): Promise<Transaction>
    skip(input: RecurringTransactionIdInput): Promise<void>
    onPendingChanged(listener: () => void): () => void
  }
  reports: {
    cashFlow(input: ReportDateRangeInput): Promise<CashFlowReport>
    spendingPace(): Promise<SpendingPaceReport>
    overviewDashboard(): Promise<OverviewDashboard>
    monthlyTrend(input: ReportDateRangeInput): Promise<MonthlyTrendReport>
    categoryBreakdown(
      input: ReportDateRangeInput,
    ): Promise<CategoryBreakdownReport>
  }
  rates: {
    status(): Promise<RateStatus>
    onStatusChanged(listener: () => void): () => void
  }
  rules: {
    list(): Promise<CategorisationRule[]>
    autofill(
      input: CategorisationRuleDraftInput,
    ): Promise<CategorisationAutofill>
    create(input: CreateCategorisationRuleInput): Promise<CategorisationRule>
    update(input: UpdateCategorisationRuleInput): Promise<CategorisationRule>
    reorder(input: ReorderCategorisationRuleInput): Promise<void>
    delete(input: CategorisationRuleIdInput): Promise<void>
  }
  updates: {
    isReady(): Promise<boolean>
    onReady(listener: () => void): () => void
    restart(): Promise<void>
  }
  getVersion(): Promise<string>
  templates: {
    list(): Promise<TransactionTemplate[]>
    create(input: CreateTemplateInput): Promise<TransactionTemplate>
    update(input: UpdateTemplateInput): Promise<TransactionTemplate>
    delete(input: TemplateIdInput): Promise<void>
    saveTransaction(
      input: SaveTransactionAsTemplateInput,
    ): Promise<TransactionTemplate>
  }
  transactions: {
    // True after writing the file; false when the native save dialog is cancelled.
    exportCsv(input?: TransactionCsvInput): Promise<boolean>
    duplicate(input: TransactionIdInput): Promise<string>
    list(input?: TransactionListInput): Promise<TransactionPage>
    create(input: CreateTransactionInput): Promise<Transaction>
    update(input: UpdateTransactionInput): Promise<Transaction>
    delete(input: DeleteTransactionInput): Promise<void>
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
  tags: {
    list(): Promise<Tag[]>
    rename(input: RenameTagInput): Promise<Tag>
    delete(input: TagIdInput): Promise<void>
  }
  payees: {
    list(): Promise<Payee[]>
    suggest(input: PayeeSuggestionInput): Promise<PayeeSuggestion[]>
    listAliases(input: PayeeAliasesInput): Promise<PayeeAlias[]>
    addAlias(input: AddPayeeAliasInput): Promise<PayeeAlias>
    removeAlias(input: PayeeAliasIdInput): Promise<void>
    merge(input: MergePayeesInput): Promise<Payee>
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
    listOptions(input?: ListAccountOptionsInput): Promise<AccountOption[]>
    create(input: CreateAccountInput): Promise<Account>
    rename(input: RenameAccountInput): Promise<Account>
    changeCurrency(input: ChangeAccountCurrencyInput): Promise<Account>
    archive(input: AccountIdInput): Promise<void>
    unarchive(input: AccountIdInput): Promise<void>
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
    pickWatchedFolder(): Promise<string | null>
    watchedFolderStatus(): Promise<WatchedFolderStatus | null>
    onWatchedFolderStatusChanged(
      listener: (status: WatchedFolderStatus | null) => void,
    ): () => void
    onWatchedFolderFailure(
      listener: (failure: WatchedFolderFailure) => void,
    ): () => void
    updateSettings(input: UpdateProfileSettingsInput): Promise<ProfileSettings>
  }
}
