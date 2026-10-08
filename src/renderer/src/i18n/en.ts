import { desktopMessages } from '../../../shared/desktop-translations'
import { csvMessages } from '../../../shared/csv-translations'
import { categoryNames } from '../../../shared/category-translations'
export const en = {
  ...desktopMessages.en,
  'privacy.toggle': 'Privacy mode',
  'privacy.hiddenAmount': 'Hidden amount',
  'privacy.shortcutScope':
    'Privacy mode works everywhere, including while typing (Ctrl+Shift+H).',
  'quickAdd.title': 'Quick add',
  'quickAdd.noProfiles':
    'Create a profile in the main window before adding a transaction.',
  'quickAdd.noAccounts':
    'Create an account in the main window before adding a transaction.',
  'quickAdd.saved': 'Saved.',
  'quickAdd.loading': 'Preparing quick add…',

  'shortcuts.closeHelp': 'Close shortcut help',
  'transactions.saveAndAddAnother': 'Save and add another',
  'shortcuts.scope':
    'With an open profile: new transaction and undo work outside text editing controls. Type and save shortcuts work in the transaction drawer.',
  'shortcuts.navigation':
    'Tab / Shift+Tab move between fields and stay inside the open dialog.',
  'shortcuts.undo': 'Undo last change (outside text editing controls)',
  'shortcuts.close': 'Cancel / close drawer or shortcut help',
  'shortcuts.help': 'Keyboard shortcuts',
  'shortcuts.save':
    'Save (except in multiline notes; buttons keep their own action)',
  'shortcuts.saveAndAddAnother':
    'Save and add another (keep date, accounts and type)',
  'shortcuts.newTransaction': 'New transaction (outside text editing controls)',
  ...categoryNames.en,
  ...csvMessages.en,
  'csv.description':
    'Export all transactions matching the applied filters, not just this page. Each split part is a separate row. Transfers and balance adjustments are not exported.',
  'csv.decimalSeparator': 'Decimal separator',
  'csv.profileDefault': 'Profile language default',
  'csv.dot': 'Dot (123.45) · comma-separated fields',
  'csv.comma': 'Comma (123,45) · semicolon-separated fields',
  'csv.saving': 'Saving CSV…',
  'csv.saved': 'CSV saved.',
  'csv.error': 'The CSV could not be saved. Try again.',
  'csv.error.separator': 'Choose a dot or comma decimal separator.',

  'rules.title': 'Categorisation rules',
  'rules.description':
    'Rules are checked in order. The first matching rule wins and can prefill payee, category, and tags before last-used payee values.',
  'rules.loading': 'Loading rules…',
  'rules.empty': 'No categorisation rules yet.',
  'rules.offer': 'Create a rule for this categorisation?',
  'rules.offerDismiss': 'Dismiss',
  'rules.create': 'Create rule',
  'rules.edit': 'Edit',
  'rules.delete': 'Delete',
  'rules.save': 'Save rule',
  'rules.enabled': 'Enabled',
  'rules.disabled': 'Disabled',
  'rules.up': 'Move rule up',
  'rules.down': 'Move rule down',
  'rules.anyPayee': 'Any payee',
  'rules.textContains': 'Note contains',
  'rules.account': 'Account condition',
  'rules.anyAccount': 'Any account',
  'rules.minimum': 'Minimum amount',
  'rules.maximum': 'Maximum amount',
  'rules.amountCurrency': 'Amount currency',
  'rules.amountCondition': 'Amount condition',
  'rules.payeeAction': 'Set payee',
  'rules.noPayeeAction': 'Do not set a payee',
  'rules.noCategory': 'Do not set a category',
  'rules.noTags': 'Create a tag in a transaction before using it in a rule.',
  'rules.action': 'Action',
  'rules.formHint':
    'Choose at least one condition and one action: payee, category, or tags.',
  'rules.amountHint':
    'Optional inclusive amount boundary in the selected rule currency.',
  'rules.error':
    'The rule operation could not be completed. Refresh and try again.',
  'rules.error.notFound': 'The rule could not be found. Refresh the list.',
  'rules.error.condition': 'Choose at least one rule condition.',
  'rules.error.text': 'Enter at most 1,000 characters of text to find.',
  'rules.error.amount': 'Enter a valid non-negative amount.',
  'rules.error.amountRange':
    'The minimum amount must not exceed the maximum amount.',
  'rules.error.action': 'Choose a payee, category, and/or at least one tag.',
  'rules.error.reference':
    'Choose existing active payees, accounts, categories, and tags.',
  'rules.error.order': 'Choose a valid rule position.',
  'payees.title': 'Payees',
  'payees.description':
    'Aliases map raw names to one payee. Matching ignores case and diacritics. Merging moves transactions and aliases to the chosen survivor.',
  'payees.loading': 'Loading payees…',
  'payees.empty': 'Payees appear here after you record a transaction.',
  'payees.aliases': 'Aliases',
  'payees.noAliases': 'No aliases.',
  'payees.aliasName': 'Raw payee name',
  'payees.addAlias': 'Add alias',
  'payees.removeAlias': 'Remove',
  'payees.mergeInto': 'Merge this payee into',
  'payees.chooseSurvivor': 'Choose the surviving payee',
  'payees.merge': 'Merge payees',
  'payees.mergeHint':
    'All transactions and aliases move to the surviving payee. You can undo this change.',
  'payees.refresh': 'Refresh',
  'payees.error': 'The payee operation could not be completed. Try again.',
  'payees.error.notFound': 'The payee could not be found. Refresh the list.',
  'payees.error.aliasNotFound':
    'The alias could not be found. Refresh the list.',
  'payees.error.aliasName': 'Enter an alias between 1 and 100 characters.',
  'payees.error.aliasConflict':
    'That raw name already belongs to a payee or alias.',
  'payees.error.samePayee': 'Choose a different surviving payee.',
  'payees.error.query': 'The payee search is invalid.',
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
  'rates.status.upToDate': 'Exchange rates are up to date',
  'rates.status.stale': 'Exchange rates are stale',
  'rates.status.missing': 'An exchange rate is missing',
  'rates.status.lastRefresh': 'Last refresh',
  'navigation.label': 'Main navigation',
  'navigation.overview': 'Overview',
  'navigation.transactions': 'Transactions',
  'navigation.receipts': 'Receipt inbox',
  'navigation.recurring': 'Recurring',
  'navigation.reports': 'Reports',
  'navigation.accounts': 'Accounts',
  'navigation.settings': 'Settings',
  'receipts.title': 'Receipts waiting for you',
  'receipts.description':
    'Review dropped receipt photos, then confirm each one as a transaction or discard it.',
  'receipts.count': 'Receipts in inbox',
  'receipts.loading': 'Loading receipt inbox…',
  'receipts.empty': 'No receipt photos are waiting.',
  'receipts.preview': 'Receipt photo preview',
  'receipts.back': 'Back to receipt inbox',
  'receipts.confirm': 'Confirm transaction',
  'receipts.discard': 'Discard',
  'receipts.reading': 'Reading receipt… You can still enter details manually.',
  'receipts.ocrPrefilled': 'read by OCR',
  'receipts.ocrLowConfidence':
    'OCR confidence is low. Check every prefilled field.',
  'receipts.currencyMismatch':
    'No active account matches the detected currency:',
  'receipts.source.drop': 'Dropped into the app',
  'receipts.source.folder': 'Watched folder',
  'receipts.source.phone': 'Phone upload',
  'receipts.dropOverlay': 'Drop receipt photos to add them to the inbox',
  'receipts.dropProcessing': 'Adding receipt photos…',
  'receipts.error': 'The receipt operation could not be completed. Try again.',
  'receipts.error.type':
    'Drop a JPEG, PNG, or WebP image. PDFs and other files are not accepted in the receipt inbox.',
  'receipts.error.size': 'Each receipt photo must be no larger than 25 MB.',
  'receipts.error.path': 'The receipt photo could not be read.',
  'receipts.error.source': 'Choose a valid receipt intake source.',
  'receipts.error.notFound':
    'The receipt could not be found. Refresh the inbox.',
  'receipts.error.preview': 'The receipt preview could not be created.',
  'recurring.title': 'Recurring transactions',
  'recurring.definitions': 'Definitions',
  'recurring.sections': 'Recurring transaction sections',
  'recurring.fromTransaction': 'Create recurring transaction',
  'recurring.fromTemplate': 'Create recurring from template',
  'recurring.fromSplitHint':
    'Split transactions cannot be used to create a recurring transaction.',
  'pending.title': 'Pending',
  'pending.empty': 'No pending transactions.',
  'pending.confirm': 'Confirm',
  'pending.editAndConfirm': 'Edit & confirm',
  'pending.skip': 'Skip',
  'pending.overdue': 'Overdue',
  'pending.dueCount': 'Due pending transactions',
  'pending.error.notFound':
    'The pending transaction could not be found. Refresh the list.',
  'pending.error.accountArchived':
    'This account is archived. Unarchive the account or skip this occurrence.',
  'recurring.description':
    'Create regular expense and income estimates. Due occurrences stay pending and do not affect your finances yet.',
  'recurring.create': 'Create recurring transaction',
  'recurring.edit': 'Edit recurring transaction',
  'recurring.save': 'Save recurring transaction',
  'recurring.empty': 'No recurring transactions yet.',
  'recurring.pause': 'Pause',
  'recurring.resume': 'Resume',
  'recurring.paused': 'Paused',
  'recurring.delete': 'Delete',
  'recurring.deleteConfirmation':
    'Delete this recurring transaction and all its pending occurrences?',
  'recurring.nextDue': 'Next due',
  'recurring.noNextDue': 'No future due date',
  'recurring.creationHint':
    'Occurrences before this recurring transaction is created are not generated. Resuming skips dates that passed while paused.',
  'recurring.schedule.label': 'Schedule',
  'recurring.schedule.monthly': 'Monthly',
  'recurring.schedule.weekly': 'Weekly',
  'recurring.schedule.yearly': 'Yearly',
  'recurring.every': 'every',
  'recurring.months': 'month(s)',
  'recurring.weeks': 'week(s)',
  'recurring.month': 'Month',
  'recurring.day': 'Day',
  'recurring.weekday': 'Weekday',
  'recurring.interval': 'Repeat interval',
  'recurring.startDate': 'Start date',
  'recurring.endDate': 'End date (optional)',
  'recurring.weekday.0': 'Sunday',
  'recurring.weekday.1': 'Monday',
  'recurring.weekday.2': 'Tuesday',
  'recurring.weekday.3': 'Wednesday',
  'recurring.weekday.4': 'Thursday',
  'recurring.weekday.5': 'Friday',
  'recurring.weekday.6': 'Saturday',
  'recurring.error':
    'The recurring transaction could not be saved. Check every field and try again.',
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
    'This month to date compared with the full last month, in your base currency.',
  'overview.error': 'The overview could not be loaded.',
  'overview.expenses': 'Expenses',
  'overview.incomes': 'Income',
  'overview.net': 'Net',
  'overview.thisMonthToDate': 'This month to date',
  'overview.fullLastMonth': 'Full last month',
  'overview.change': 'Change vs last month',
  'overview.topCategories': 'Top 5 expense categories this month',
  'overview.transactions': 'View transactions',
  'overview.reports': 'View reports',
  'overview.chartLabel': 'Top five expense categories this month',
  'overview.shareHint':
    'Shares use converted expenses across all categories, not only the top five. Unconverted amounts are shown separately and are not included in shares.',
  'reports.trend.title': 'Monthly trend',
  'reports.trend.description':
    'Expenses, incomes and net in your base currency.',
  'reports.trend.partial': 'partial',
  'reports.trend.partialHint':
    'Partial months include only days within the selected range.',
  'reports.trend.unconvertedHint':
    'Amounts without a rate are not in the chart. Each month lists them separately below.',
  'reports.trend.chartLabel': 'Monthly expenses and incomes with a net line',
  'reports.trend.month': 'Month',
  'reports.trend.expenses': 'Expenses',
  'reports.trend.incomes': 'Incomes',
  'reports.trend.net': 'Net',
  'reports.pace.title': 'Spending pace',
  'reports.pace.description':
    'This month so far compared with the average of the previous three calendar months up to the same day, clamped to each month’s length.',
  'reports.pace.current': 'This month so far',
  'reports.pace.average': 'Three-month average',
  'reports.pace.difference': 'Compared with usual spending',
  'reports.pace.ahead': 'Ahead',
  'reports.pace.behind': 'Behind',
  'reports.pace.onPace': 'On pace',
  'reports.pace.noBaseline': 'No baseline for a percentage',
  'reports.pace.partial':
    'Partial comparison: some amounts could not be converted. See the affected months below.',
  'reports.pace.months': 'Comparison months',
  'reports.pace.refresh': 'Refresh pace',
  'reports.pace.chartLabel':
    'This month’s expenses so far versus the three-month average',
  'reports.title': 'Expenses by category',
  'reports.description':
    'Compare category totals in your base currency and drill down to the transactions behind them.',
  'reports.heading': 'Reports in your base currency',
  'reports.introduction':
    'Explore categories, monthly trends and cash flow for your chosen range, or compare this month’s spending pace.',
  'reports.view': 'Report view',
  'reports.cashFlow.title': 'Cash flow',
  'reports.cashFlow.income': 'Income',
  'reports.cashFlow.expense': 'Expenses',
  'reports.cashFlow.uncategorizedIncome': 'Uncategorized income',
  'reports.cashFlow.uncategorizedExpense': 'Uncategorized expenses',
  'reports.cashFlow.deficit': 'From savings / deficit',
  'reports.cashFlow.surplus': 'Saved / surplus',
  'reports.cashFlow.empty':
    'No converted income or expenses in this date range.',
  'reports.cashFlow.description':
    'Income categories flow through Income to expense categories. Savings balance the converted flows; unconverted amounts stay separate.',
  'reports.cashFlow.rounding':
    'Flows use rounded category totals; their sum can differ slightly from a whole-period total rounded once.',
  'reports.dateRange': 'Report date range',
  'reports.period.thisMonth': 'This month',
  'reports.period.lastMonth': 'Last month',
  'reports.period.thisYear': 'This year',
  'reports.period.last12Months': 'Last 12 months',
  'reports.period.custom': 'Custom range',
  'reports.apply': 'Apply range',
  'reports.loading': 'Loading report…',
  'reports.error': 'The report could not be loaded. Please try again.',
  'reports.error.range':
    'Enter a valid date range on or after 1900-01-01 spanning no more than 100 years.',
  'reports.total': 'Total expenses',
  'reports.provisional': 'provisional rates',
  'reports.chartType': 'Chart type',
  'reports.pie': 'Pie',
  'reports.bar': 'Bar',
  'reports.unconverted': 'Unconverted',
  'reports.empty': 'No included expenses in this date range.',
  'reports.chartLabel': 'Expense category chart',
  'reports.categories': 'Main categories',
  'reports.subcategories': 'Subcategories',
  'reports.amount': 'Amount',
  'reports.share': 'Share',
  'reports.uncategorized': 'Uncategorized',
  'reports.back': 'Back to main categories',
  'reports.drillHint':
    'Choose a main category, then choose a subcategory to open its transactions.',
  'reports.transactionFilter': 'From report:',
  'reports.transactionFilter.expense': 'expenses only',
  'reports.transactionFilter.income': 'income only',
  'reports.transactionFilter.exactCategory': 'without subcategories',
  'reports.transactionFilter.clear': 'Show all kinds and subcategories',
  'transactions.title': 'Your transactions in one place',
  'transactions.description':
    'Record expenses, income and transfers, then keep account balances up to date.',
  'transactions.listDescription':
    'Filter transactions by period, account, category, payee, tag or note.',
  'adjustments.setRealBalance': 'Set real balance',
  'adjustments.edit': 'Edit balance adjustment',
  'adjustments.save': 'Save balance adjustment',
  'adjustments.deleteConfirmation':
    'Permanently delete this balance adjustment? The account balance will update.',
  'adjustments.confirmDelete': 'Delete balance adjustment',
  'adjustments.rowType': 'Balance adjustment',
  'adjustments.observedBalance': 'Observed balance',
  'adjustments.difference': 'Current difference',
  'adjustments.zeroDifference': 'No correction needed',
  'adjustments.zeroDifferenceHint':
    'This adjustment no longer corrects anything and can be deleted.',
  'adjustments.error.account': 'Choose an active account.',
  'adjustments.error.date': 'Enter a valid calendar date.',
  'adjustments.error.futureDate':
    'The balance observation date cannot be in the future.',
  'adjustments.error.balance':
    'Enter a valid balance within ±90,071,992,547,409.91.',
  'adjustments.error.note': 'Enter a note of at most 1,000 characters.',
  'adjustments.error.notFound':
    'The balance adjustment could not be found. Refresh the list.',
  'transactions.excluded': 'Excluded',
  'transactions.excludedHint':
    'Included in the account balance, but left out of expense and income totals.',
  'transactions.exclusion': 'Excluded transactions',
  'transactions.exclusion.all': 'All transactions',
  'transactions.exclusion.onlyExcluded': 'Only excluded',
  'transactions.exclusion.hideExcluded': 'Hide excluded',
  'transactions.error.excluded': 'Choose whether the transaction is excluded.',
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
  'transactions.baseTotal': 'Base-currency total',
  'transactions.unconverted': 'Unconverted',
  'transactions.provisional': 'provisional',
  'transactions.matches': 'transactions',
  'transactions.noMatches': 'No transactions match these filters.',
  'transactions.previousPage': 'Previous page',
  'transactions.nextPage': 'Next page',
  'transactions.actions': 'Actions',
  'transactions.error.filters':
    'Choose valid filters and an ordered date range.',
  'transactions.error.totals':
    'The filtered total is too large to represent exactly.',
  'transactions.duplicate': 'Duplicate transaction',
  'templates.title': 'Transaction templates',
  'templates.choose': 'Choose a template',
  'templates.use': 'Use template',
  'templates.create': 'Create template',
  'templates.edit': 'Edit template',
  'templates.delete': 'Delete template',
  'templates.save': 'Save template',
  'templates.name': 'Template name',
  'templates.saveTransaction': 'Save as template',
  'templates.savedTransactionHint':
    'Uses the saved transaction, not unsaved drawer changes.',
  'templates.optionalHint':
    'Only the name is required. Leave any other field blank to enter it when using the template.',
  'templates.tagsHint':
    'One tag name per line. Missing tags are created when saving the template.',
  'templates.deleteConfirmation': 'Delete this transaction template?',
  'templates.amountRequired': 'Enter an amount before saving this transaction.',
  'templates.error.name': 'Enter a template name between 1 and 100 characters.',
  'templates.error.split': 'Split transactions cannot be saved as templates.',
  'templates.error.notFound':
    'The transaction template could not be found. Refresh the list.',
  'transactions.create': 'Record transaction',
  'transactions.edit': 'Edit transaction',
  'transactions.delete': 'Delete',
  'transactions.deleteConfirmation':
    'Permanently delete this transaction? Its account balance will update.',
  'transactions.confirmDelete': 'Delete transaction',
  'attachments.title': 'Attachments',
  'attachments.add': 'Add',
  'attachments.drop': 'Drop JPEG, PNG, WebP, or PDF files here.',
  'attachments.empty': 'No attachments.',
  'attachments.open': 'Open',
  'attachments.remove': 'Remove',
  'attachments.deleteWithTransaction': 'Delete transaction and its attachments',
  'attachments.saveCopiesAndDelete':
    'Save attachment copies to a folder…, then delete',
  'attachments.error.type':
    'Choose a JPEG, PNG, WebP, or PDF file. File types are checked from their contents.',
  'attachments.error.size': 'Each attachment must be no larger than 25 MB.',
  'attachments.error.path': 'The selected file could not be read.',
  'attachments.error.store':
    'The attachment could not be copied into this profile.',
  'attachments.error.staged': 'The staged attachment is no longer available.',
  'attachments.error.notFound':
    'The attachment could not be found. Refresh the transaction.',
  'attachments.error.copy':
    'The attachment copies could not be saved to that folder.',
  'attachments.error.open': 'The attachment could not be opened.',
  'transactions.cancel': 'Cancel',
  'transactions.close': 'Close transaction drawer',
  'transactions.save': 'Save transaction',
  'transactions.loading': 'Loading transactions…',
  'transactions.empty': 'No transactions recorded yet.',
  'transactions.noAccounts':
    'Create an active account before recording a transaction.',
  'transactions.refresh': 'Refresh',
  'transactions.kind': 'Transaction type',
  'transactions.expense': 'Expense',
  'transactions.income': 'Income',
  'transactions.transfer': 'Transfer',
  'transactions.date': 'Date',
  'transactions.amount': 'Amount',
  'amount.result': 'Calculated amount',
  'transactions.amountHint':
    'Use + - * /, parentheses, dot or comma decimals, and thousands grouping (e.g. 1 234,50). Blur or Enter calculates; the final result is rounded to hundredths.',
  'transactions.account': 'Account',
  'transactions.fromAccount': 'From account',
  'transactions.toAccount': 'To account',
  'transactions.fromAmount': 'Amount sent',
  'transactions.toAmount': 'Amount received',
  'transactions.actualRate': 'Actual rate',
  'transactions.fee': 'Fee amount',
  'transactions.feeCategory': 'Fee category',
  'transactions.optional': 'Optional',
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
    'Enter a valid expression yielding a positive amount within 90,071,992,547,409.91. Division by zero is not allowed.',
  'transactions.error.payee': 'Enter a payee name of at most 100 characters.',
  'transactions.error.category':
    'Choose an active category matching expense or income.',
  'transactions.error.note': 'Enter a note of at most 1,000 characters.',
  'transactions.error.notFound':
    'The transaction could not be found. Refresh the list.',
  'transactions.error.lines': 'The transaction lines do not match its total.',
  'splits.split': 'Split',
  'splits.unsplit': 'Return to one part',
  'splits.remaining': 'Remaining amount',
  'splits.part': 'Part',
  'splits.remove': 'Remove part',
  'splits.addPart': 'Add part',
  'splits.indicator': 'Split',
  'tags.title': 'Tags',
  'tags.all': 'All tags',
  'tags.manage': 'Manage tags',
  'tags.empty': 'Create tags in the transaction drawer.',
  'tags.name': 'Tag name',
  'tags.rename': 'Rename',
  'tags.delete': 'Delete tag',
  'tags.save': 'Save tag',
  'tags.add': 'Add tag',
  'tags.remove': 'Remove tag',
  'tags.hint':
    'Choose an existing tag or type a new one. Press Enter or Add tag; new tags are created when you save.',
  'tags.deleteConfirmation':
    'Delete this tag and remove it from all transactions?',
  'tags.error.name': 'Enter tag names between 1 and 100 characters.',
  'tags.error.notFound': 'The tag could not be found. Refresh the list.',
  'tags.error.duplicate': 'A tag with this name already exists.',
  'undo.available': 'Change saved.',
  'transfers.error.accountsDiffer': 'Choose two different accounts.',
  'transfers.error.equalAmounts':
    'Amounts must be equal when both accounts use the same currency.',
  'transfers.error.notFound':
    'The transfer could not be found. Refresh the list.',
  'transfers.error.linkedFee': 'Edit or delete this fee through its transfer.',
  'undo.action': 'Undo',
  'undo.error': 'The change could not be undone.',
  'accounts.title': 'A place for each account',
  'accounts.description':
    'Each balance combines its dated movements and observed balance adjustments in the account currency.',
  'accounts.create': 'Create account',
  'accounts.name': 'Account name',
  'accounts.currency': 'Currency',
  'accounts.openingBalance': 'Opening balance',
  'accounts.openingDate': 'Opening date',
  'accounts.balance': 'Balance',
  'accounts.balanceHint':
    'Use + - * /, parentheses, dot or comma decimals, and thousands grouping. Blur or Enter calculates, rounding the final result to hundredths. Negative and zero balances are allowed.',
  'accounts.empty': 'Create an account to start tracking its balance.',
  'accounts.loading': 'Loading accounts…',
  'accounts.rename': 'Rename',
  'accounts.changeCurrency': 'Change currency',
  'accounts.archive': 'Archive',
  'accounts.unarchive': 'Unarchive',
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
    'Enter a valid expression yielding a balance within ±90,071,992,547,409.91. Division by zero is not allowed.',
  'accounts.error.date': 'Enter a valid opening date.',
  'accounts.error.notFound':
    'The account could not be found. Refresh the list.',
  'accounts.error.currencyLocked':
    'Currency cannot change once the account has transactions.',
  'accounts.error.notEmpty':
    'This account has transactions and cannot be deleted. Archive it instead.',
  'settings.title': 'Make yourself at home',
  'settings.description':
    'Language, appearance, base currency and receipt intake are saved for this profile and apply immediately.',
  'settings.baseCurrency': 'Base currency',
  'settings.version': 'App version',
  'settings.error': 'The settings could not be saved. Please try again.',
  'watchedFolder.title': 'Watched folder',
  'watchedFolder.hint':
    'Any local folder outside Financial Tracker data works, including one synced by Google Drive for Desktop or OneDrive. Complete receipt photos are moved into its feldolgozott subfolder.',
  'watchedFolder.error.userData':
    'Choose a folder outside the Financial Tracker data folder.',
  'watchedFolder.current': 'Current folder',
  'watchedFolder.none': 'No folder selected',
  'watchedFolder.status': 'Status',
  'watchedFolder.status.watching': 'Watching',
  'watchedFolder.status.unavailable': 'Folder unavailable',
  'watchedFolder.choose': 'Choose folder',
  'watchedFolder.clear': 'Clear',
  'watchedFolder.intakeFailure': 'A watched receipt photo could not be added',
  'watchedFolder.dismissFailure': 'Dismiss',
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
  'phoneUpload.title': 'Upload from phone',
  'phoneUpload.starting': 'Starting the private network upload…',
  'phoneUpload.noPrivateNetwork':
    'Not connected to a private network. Connect this PC to your private Wi-Fi and try again.',
  'phoneUpload.error': 'Phone upload could not be started. Try again.',
  'phoneUpload.interface': 'Private network connection',
  'phoneUpload.qrAlt': 'QR code for the phone upload address',
  'phoneUpload.address': 'Or open this address on your phone',
  'phoneUpload.expiresIn': 'Stops automatically in {time}',
  'phoneUpload.expired': 'This upload session has stopped.',
  'phoneUpload.uploaded': '{count} uploaded',
  'phoneUpload.firewallTitle': 'Windows firewall',
  'phoneUpload.firewallGuidance':
    'Windows may ask to allow “Financial Tracker”. Allow it on Private networks only. If the phone cannot connect, make sure both devices use the same Wi-Fi and the Windows network is set to Private.',
  'phoneUpload.close': 'Close',

  'help.accessibleName': 'Help',
  'help.page.profilePicker':
    'A profile is one person’s separate set of finances. Choose an existing profile or create a new one; each profile is stored locally in its own database.',
  'help.profilePicker.profiles':
    'Open a profile to use its separate finances and settings. You can also rename it or permanently delete its local data.',
  'help.profilePicker.create':
    'Create a profile for another separate set of finances on this PC. Give it a recognizable name; you can change the name later.',
  'help.page.overview':
    'See this month’s expenses, income and net amount compared with the full previous month; excluded transactions are left out. Amounts are converted to your base currency when an exchange rate is available.',
  'help.page.transactions':
    'Record and review expenses, income, transfers and balance adjustments. Use filters to narrow the list and its totals.',
  'help.page.receipts':
    'Receipt photos wait here until you confirm them as transactions or discard them. Text recognition runs locally; always check prefilled details.',
  'help.page.recurring':
    'Define expenses or income that repeat on a schedule. Due occurrences become pending and affect your finances only after you confirm them.',
  'help.page.reports':
    'Explore expenses and income in your base currency; excluded transactions are left out. Amounts without an exchange rate remain listed separately and do not enter converted charts or totals.',
  'help.page.accounts':
    'An account is a place where money is held in one currency. Its balance combines the opening balance, dated movements and balance adjustments.',
  'help.page.settings':
    'Most settings apply to the current profile. The Quick add shortcut and Start with Windows setting apply to every profile on this Windows account.',
  'help.page.quickAdd':
    'Record an expense or income in the active profile without opening the main window. Choose the account, review the details, then save.',
  'help.overview.expenses':
    'This month’s expenses so far, with excluded transactions left out, compared with the full previous month. Select View transactions to inspect the matching transactions.',
  'help.overview.incomes':
    'This month’s income so far, with excluded transactions left out, compared with the full previous month. Select View transactions to inspect the matching transactions.',
  'help.overview.net':
    'Income minus expenses for each shown period. Transfers, balance adjustments and excluded transactions do not change this amount.',
  'help.overview.topCategories':
    'The five expense categories with the largest converted totals this month, with excluded transactions left out. Choose a category to open its transactions.',
  'help.transactions.filters':
    'Filters change the transactions shown and the totals above the list. Apply them before exporting; CSV export uses all matching transactions, not only the current page.',
  'help.transactions.excluded':
    'An excluded transaction still changes its account balance but is left out of expense and income totals and reports. Use this for movements such as reimbursable expenses.',
  'help.transactions.templates':
    'A transaction template stores reusable prefilled details. Choose one to fill the drawer, or create a template with fields you often enter together.',
  'help.transactions.duplicate':
    'Duplicate immediately saves a new transaction dated today with the original details and tags. Use Undo if you do not want to keep the copy.',
  'help.transactions.balanceAdjustment':
    'Record the real observed account balance at the end of a date. The app recalculates the difference from account history, without counting it as expense or income.',
  'help.transactions.csvExport':
    'Export expenses and income matching the applied filters. Split parts become separate rows; transfers and balance adjustments are not exported.',
  'help.transactions.csvSeparator':
    'Choose how decimal fractions are written for your spreadsheet. Dot uses comma-separated fields; comma uses semicolon-separated fields to avoid ambiguity.',
  'help.transactions.amountCalculator':
    'You can enter a calculation with + - * / and parentheses. Leaving the field or pressing Enter evaluates it and rounds the final result to hundredths.',
  'help.transactions.split':
    'A split divides one transaction into parts with separate amounts, categories, tags and notes. Make the parts add up to the transaction total.',
  'help.transactions.transfer':
    'A transfer moves money between two accounts and is neither expense nor income. For different currencies, enter both actual amounts; the app derives the rate.',
  'help.transactions.transferFee':
    'A transfer fee is recorded as a separate expense in the source account. Choose its category and exclude it only if it should stay out of reports.',
  'help.transactions.tags':
    'Tags group transactions independently of their categories. Add existing or new tags, and use Manage tags to rename or delete them.',
  'help.transactions.attachments':
    'Attachments are copied into this profile and kept with the transaction. Add receipt photos, images or PDFs; removing one deletes the profile copy.',
  'help.receipts.phoneUpload':
    'Start a temporary upload page for a phone on the same private Wi-Fi. Anyone who can open the address during the session can access its uploads, so use only a trusted private network and close it when finished.',
  'help.recurring.pending':
    'Pending transactions are due occurrences waiting for your decision. Confirm one to record it, edit and confirm its amount or date, or skip that occurrence.',
  'help.recurring.definitions':
    'Definitions hold the reusable details and schedule for recurring transactions. Pausing stops new pending occurrences; resuming skips dates that passed while paused.',
  'help.recurring.editor':
    'Set the transaction details and schedule used for future occurrences. No occurrence is created for a date before the definition was created.',
  'help.recurring.schedule':
    'Choose how often the transaction repeats and its calendar day. An optional end date stops future occurrences after that date.',
  'help.reports.dateRange':
    'Choose the dates included in category, monthly trend and cash-flow reports. Spending pace always compares this month to the previous three calendar months.',
  'help.reports.category':
    'Expenses are grouped by main category in your base currency; excluded transactions are left out. Choose a main category, then a subcategory, to open the matching transactions.',
  'help.reports.trend':
    'Compare monthly expenses, income and net amount; excluded transactions are left out. Partial months use only dates inside the selected range.',
  'help.reports.pace':
    'Compare this month’s expenses so far, with excluded transactions left out, against the average of the previous three calendar months up to the same day. Shorter months are compared through their last day.',
  'help.reports.cashFlow':
    'See converted income categories flow into expense categories. The difference between income and expenses appears as savings or deficit; unconverted amounts stay separate.',
  'help.reports.breakdown':
    'Choose a main category to see its subcategories. Choosing a subcategory opens the expense transactions behind that total; excluded transactions are left out.',
  'help.accounts.create':
    'Create an account for each place and currency where money is held. Set the balance and date from which its history should begin.',
  'help.accounts.currency':
    'Each account has exactly one currency. You can change it only before the account has transactions.',
  'help.accounts.openingBalance':
    'The opening balance is the account balance at the start of its history on the opening date. It may be positive, zero or negative, and you can enter a calculation in the field.',
  'help.accounts.archive':
    'Archiving hides an account from entry pickers without deleting its history or balance. Unarchive it when you need to use it again.',
  'help.settings.categories':
    'Categories classify expense or income in up to two levels: main category and subcategory. Reorder or archive them without changing existing transaction history.',
  'help.settings.payees':
    'A payee is the normalized name used on transactions. Add aliases for raw or alternate names; merging moves transactions and aliases to the surviving payee.',
  'help.settings.rules':
    'Rules automatically prefill payee, category or tags when a transaction matches. They run in order and the first matching rule wins.',
  'help.settings.ruleAmountCurrency':
    'Amount boundaries are compared in this currency. If the rule has an account condition, that account’s currency is used automatically.',
  'help.settings.backups':
    'A local database backup is created when this profile opens, and the latest ten startup backups are kept. Restoring replaces current profile data with the selected backup.',
  'help.settings.watchedFolder':
    'The app imports new receipt photos from this folder into the receipt inbox. After a successful intake, the original files move to the feldolgozott subfolder; a synced local folder can accept photos from another device.',
  'help.settings.shortcut':
    'This system-wide shortcut opens Quick add even when the main window is hidden, and applies to every profile on this Windows account. Focus the shortcut field and press the desired key combination.',
  'help.settings.autostart':
    'This is off by default. When enabled, Financial Tracker starts hidden in the notification area when you sign in to Windows. This setting applies to every profile on this Windows account.',
  'help.settings.baseCurrency':
    'Reports convert other currencies into this currency using the exchange rate for each date. Changing it changes report display, not stored account amounts.',
  'help.settings.exchangeRates':
    'The app downloads and stores official MNB exchange rates locally for report conversion. If a rate is missing or stale, affected amounts remain separate until rates refresh.',
  'help.settings.privacy':
    'Privacy mode hides displayed amounts and obscures chart values without changing stored data. Toggle it anywhere with Ctrl+Shift+H.',
  'help.settings.formattingPreview':
    'This preview shows how the selected language formats dates and numbers. It does not change stored values.',
}

export type MessageKey = keyof typeof en
export type MessageCatalog = Record<MessageKey, string>
