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
