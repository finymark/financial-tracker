export const en = {
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
  'overview.title': 'A clear view of your finances',
  'overview.description':
    'Your financial overview will appear here once accounts and transactions are available.',
  'transactions.title': 'Your transactions in one place',
  'transactions.description':
    'Recording and reviewing expenses and incomes will be available here later.',
  'accounts.title': 'A place for each account',
  'accounts.description':
    'Your accounts and their balances will be available here later.',
  'settings.title': 'Make yourself at home',
  'settings.description':
    'Language and appearance changes apply immediately. These temporary choices reset when the app restarts; profile settings will come later.',
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
