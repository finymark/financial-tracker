import { categoryNames } from '../../../shared/category-translations'
export const en = {
  ...categoryNames.en,
  'categories.title': 'Categories',
  'categories.description':
    'Expense and income categories have at most two levels. Default names follow your language; custom names stay unchanged. Archiving a main category also hides its subcategories from pickers.',
  'categories.expense': 'Expense',
  'categories.income': 'Income',
  'categories.loading': 'Loading categories…',
  'categories.name': 'Category name',
  'categories.kind': 'Expense or income',
  'categories.parent': 'Main category',
  'categories.main': 'No parent (main category)',
  'categories.create': 'Create category',
  'categories.rename': 'Rename',
  'categories.archive': 'Archive',
  'categories.unarchive': 'Unarchive',
  'categories.archived': 'Archived — hidden from category pickers',
  'categories.delete': 'Delete',
  'categories.deleteConfirmation': 'Permanently delete this category?',
  'categories.confirmDelete': 'Delete category permanently',
  'categories.replacement': 'Replacement category',
  'categories.chooseReplacement': 'Choose a replacement',
  'categories.noReplacement': 'No replacement (unused category)',
  'categories.save': 'Save',
  'categories.cancel': 'Cancel',
  'categories.refresh': 'Refresh',
  'categories.up': 'Move up',
  'categories.down': 'Move down',
  'categories.error':
    'The category operation could not be completed. Refresh and try again.',
  'categories.error.name':
    'Enter a category name between 1 and 100 characters.',
  'categories.error.kind': 'Choose expense or income.',
  'categories.error.notFound':
    'The category could not be found. Refresh the list.',
  'categories.error.parent':
    'Choose an active main category of the same kind. Categories have at most two levels.',
  'categories.error.order': 'Choose a valid position among sibling categories.',
  'categories.error.children':
    'Delete subcategories before deleting their main category.',
  'categories.error.replacementRequired':
    'This category has transactions. Choose a replacement to preserve them.',
  'categories.error.replacement':
    'Choose a different, active replacement of the same kind.',
  'updates.ready': 'An update is downloaded. Restart to install it.',
  'updates.restart': 'Restart and update',
  'updates.error': 'Could not restart for the update. Please try again.',
  'app.name': 'Financial Tracker',
  'app.tagline': 'Your finances, on your PC.',
  'navigation.label': 'Main navigation',
  'navigation.overview': 'Overview',
  'navigation.transactions': 'Transactions',
  'navigation.accounts': 'Accounts',
  'navigation.settings': 'Settings',
  'sidebar.collapse': 'Collapse sidebar',
  'sidebar.expand': 'Expand sidebar',
  'sidebar.profile': 'Profiles',
  'sidebar.profileHint': 'Profile switching will be available here later.',
  'profilePicker.title': 'Choose a profile',
  'profilePicker.description':
    'Each profile keeps its finances in a separate local database.',
  'profilePicker.choose': 'Profiles',
  'profilePicker.empty': 'Create the first profile to get started.',
  'profile.loading': 'Loading profiles…',
  'profile.open': 'Open profile',
  'profile.create': 'Create profile',
  'profile.createDescription': 'Give this separate set of finances a name.',
  'profile.name': 'Profile name',
  'profile.rename': 'Rename',
  'profile.renameLabel': 'New profile name',
  'profile.save': 'Save name',
  'profile.delete': 'Delete',
  'profile.deleteDescription':
    'This permanently deletes the profile database and all of its local data.',
  'profile.typeName': 'Type the profile name to confirm:',
  'profile.confirmDelete': 'Delete profile permanently',
  'profile.cancel': 'Back to profile',
  'profile.switch': 'Switch profile',
  'profile.error': 'The profile operation could not be completed.',
  'profiles.error.name': 'Enter a profile name between 1 and 100 characters.',
  'profiles.error.notFound':
    'The profile could not be found. Refresh the list.',
  'profiles.error.confirmation':
    'Type the profile name exactly to confirm deletion.',
  'profiles.error.registryRead': 'The profile list could not be read.',
  'profiles.error.registryWrite': 'The profile list could not be saved.',
  'profiles.error.delete':
    'The profile could not be deleted safely and remains available.',
  'profiles.error.newerSchema':
    'This profile was opened by a newer app version and cannot be opened safely.',
  'profiles.error.migration':
    'The profile upgrade failed. Its pre-upgrade database was preserved.',
  'profiles.error.identity':
    'The profile database does not match the selected profile.',
  'overview.title': 'A clear view of your finances',
  'overview.description':
    'A summarized financial overview will be available here later.',
  'transactions.title': 'Your transactions in one place',
  'transactions.description':
    'Record expenses and income, then keep account balances up to date.',
  'transactions.listDescription':
    'Filter transactions by period, account, category, payee or note.',
  'transactions.filters': 'Transaction filters',
  'transactions.period': 'Period',
  'transactions.period.all': 'All dates',
  'transactions.period.thisMonth': 'This month',
  'transactions.period.lastMonth': 'Last month',
  'transactions.period.thisYear': 'This year',
  'transactions.period.custom': 'Custom range',
  'transactions.from': 'From',
  'transactions.to': 'To',
  'transactions.allAccounts': 'All accounts',
  'transactions.allCategories': 'All categories',
  'transactions.allPayees': 'All payees',
  'transactions.search': 'Payee or note',
  'transactions.applyFilters': 'Apply filters',
  'transactions.filteredTotals': 'Filtered totals',
  'transactions.matches': 'transactions',
  'transactions.noMatches': 'No transactions match these filters.',
  'transactions.previousPage': 'Previous page',
  'transactions.nextPage': 'Next page',
  'transactions.actions': 'Actions',
  'transactions.error.filters':
    'Choose valid filters and an ordered date range.',
  'transactions.error.totals':
    'The filtered total is too large to represent exactly.',
  'transactions.create': 'Record transaction',
  'transactions.edit': 'Edit transaction',
  'transactions.delete': 'Delete',
  'transactions.deleteConfirmation':
    'Permanently delete this transaction? Its account balance will update.',
  'transactions.confirmDelete': 'Delete transaction',
  'transactions.cancel': 'Cancel',
  'transactions.close': 'Close transaction drawer',
  'transactions.save': 'Save transaction',
  'transactions.loading': 'Loading transactions…',
  'transactions.empty': 'No transactions recorded yet.',
  'transactions.noAccounts':
    'Create an active account before recording a transaction.',
  'transactions.refresh': 'Refresh',
  'transactions.kind': 'Expense or income',
  'transactions.expense': 'Expense',
  'transactions.income': 'Income',
  'transactions.date': 'Date',
  'transactions.amount': 'Amount',
  'transactions.amountHint':
    'Enter a positive amount with a dot or comma and up to two decimal places.',
  'transactions.account': 'Account',
  'transactions.chooseAccount': 'Choose an active account',
  'transactions.payee': 'Payee',
  'transactions.payeeHint':
    'Choose an existing name or type a new payee to create it.',
  'transactions.category': 'Category',
  'transactions.note': 'Note',
  'transactions.noPayee': 'No payee',
  'transactions.noCategory': 'No category',
  'transactions.unknownAccount': 'Unknown account',
  'transactions.error':
    'The transaction operation could not be completed. Refresh and try again.',
  'transactions.error.account': 'Choose an active account.',
  'transactions.error.kind': 'Choose expense or income.',
  'transactions.error.date': 'Enter a valid calendar date.',
  'transactions.error.futureDate':
    'The transaction date cannot be in the future.',
  'transactions.error.amount':
    'Enter a positive amount with up to two decimal places.',
  'transactions.error.payee': 'Enter a payee name of at most 100 characters.',
  'transactions.error.category':
    'Choose an active category matching expense or income.',
  'transactions.error.note': 'Enter a note of at most 1,000 characters.',
  'transactions.error.notFound':
    'The transaction could not be found. Refresh the list.',
  'transactions.error.lines': 'The transaction lines do not match its total.',
  'accounts.title': 'A place for each account',
  'accounts.description':
    'Each balance combines its opening balance with income and expenses in the account currency.',
  'accounts.create': 'Create account',
  'accounts.name': 'Account name',
  'accounts.currency': 'Currency',
  'accounts.openingBalance': 'Opening balance',
  'accounts.openingDate': 'Opening date',
  'accounts.balance': 'Balance',
  'accounts.balanceHint':
    'Use a dot or comma and up to two decimal places, without thousands separators. Negative balances are allowed.',
  'accounts.empty': 'Create an account to start tracking its balance.',
  'accounts.loading': 'Loading accounts…',
  'accounts.rename': 'Rename',
  'accounts.changeCurrency': 'Change currency',
  'accounts.archive': 'Archive',
  'accounts.archived': 'Archived — hidden from account pickers',
  'accounts.delete': 'Delete',
  'accounts.deleteConfirmation': 'Permanently delete this account?',
  'accounts.confirmDelete': 'Delete account permanently',
  'accounts.save': 'Save',
  'accounts.cancel': 'Cancel',
  'accounts.refresh': 'Refresh',
  'accounts.locked':
    'Accounts with transactions cannot be deleted or have their currency changed.',
  'accounts.error':
    'The account operation could not be completed. Refresh and try again.',
  'accounts.error.name': 'Enter an account name between 1 and 100 characters.',
  'accounts.error.currency': 'Choose HUF or CHF.',
  'accounts.error.balance':
    'Enter a valid balance with up to two decimal places, no grouping, and within ±90,071,992,547,409.91.',
  'accounts.error.date': 'Enter a valid opening date.',
  'accounts.error.notFound':
    'The account could not be found. Refresh the list.',
  'accounts.error.currencyLocked':
    'Currency cannot change once the account has transactions.',
  'accounts.error.notEmpty':
    'This account has transactions and cannot be deleted. Archive it instead.',
  'settings.title': 'Make yourself at home',
  'settings.description':
    'Language, appearance and base currency are saved for this profile and apply immediately.',
  'settings.baseCurrency': 'Base currency',
  'settings.version': 'App version',
  'settings.error': 'The settings could not be saved. Please try again.',
  'backups.title': 'Backups',
  'backups.description':
    'A database backup is taken whenever you open this profile. The last 10 startup backups are kept; pre-migration backups are stored separately.',
  'backups.loading': 'Loading backups…',
  'backups.empty': 'No startup backups are available.',
  'backups.choose': 'Backup date and time',
  'backups.restore': 'Restore backup',
  'backups.confirmDescription':
    'Restore this backup? This replaces the current profile database and discards changes made since the backup.',
  'backups.confirmRestore': 'Confirm restore',
  'backups.cancel': 'Cancel',
  'backups.error':
    'The backup operation failed. If recovery also failed, restart the app before continuing.',
  'backups.restored':
    'Backup restored. The profile database has been reopened.',
  'backups.error.confirmation': 'Confirm the restore before continuing.',
  'backups.error.notFound':
    'That backup is no longer available. Refresh the list.',
  'backups.error.restore':
    'The backup could not be restored; the previous database was reopened.',
  'backups.error.recovery':
    'Backup recovery failed. Restart the app before continuing.',
  'backups.error.create':
    'The startup backup could not be created and verified.',
  'backups.error.invalid': 'The selected backup is corrupt or invalid.',
  'backups.error.foreign': 'The selected backup belongs to another profile.',
  'backups.error.newerSchema':
    'The selected backup requires a newer app version.',
  'settings.language': 'Language',
  'settings.theme': 'Appearance',
  'language.hu': 'Hungarian',
  'language.en': 'English',
  'language.de': 'German',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.system': 'Follow Windows',
  'settings.preview': 'Formatting preview',
  'settings.date': 'Date',
  'settings.number': 'Number',
}

export type MessageKey = keyof typeof en
export type MessageCatalog = Record<MessageKey, string>
