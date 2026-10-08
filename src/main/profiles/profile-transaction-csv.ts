import type Database from 'better-sqlite3'
import type { TransactionCsvInput } from '../../shared/transaction-csv'
import { parseTransactionCsvInput } from './transaction-csv-validation'
import { listAccountOptions } from './profile-accounts'
import { listFilteredTransactions } from './profile-transactions'
import { listCategories } from './profile-categories'
import type { Language } from '../../shared/settings'
import { csvHeaderKeys, csvMessages } from '../../shared/csv-translations'

export function exportTransactionsCsv(
  database: Database.Database,
  value: TransactionCsvInput | undefined,
  clock: () => Date,
): string {
  const input = parseTransactionCsvInput(value)
  const accounts = new Map(
    listAccountOptions(database, { includeArchived: true }).map((account) => [
      account.id,
      account,
    ]),
  )
  const { language } = database
    .prepare('SELECT language FROM profile_settings WHERE id = 1')
    .get() as { language: Language }
  const messages = csvMessages[language]
  const decimal = input.decimalSeparator ?? (language === 'en' ? '.' : ',')
  const delimiter = decimal === ',' ? ';' : ','
  const quote = (text: string) =>
    text.includes(delimiter) || /["\r\n]/.test(text)
      ? `"${text.replaceAll('"', '""')}"`
      : text
  const textCell = (value: string) =>
    quote(/^[=+@\-\t\r]/.test(value) ? `'${value}` : value)
  const categories = new Map(
    listCategories(database, language).map((category) => [
      category.id,
      category,
    ]),
  )
  const rows = [
    csvHeaderKeys.map((key) => quote(messages[key])).join(delimiter),
  ]
  for (const transaction of listFilteredTransactions(database, input, clock)) {
    const account = accounts.get(transaction.accountId)!
    for (const line of transaction.lines) {
      const amount = BigInt(line.amountMinor)
      const amountText = `${transaction.kind === 'expense' ? '-' : ''}${amount / 100n}${decimal}${String(amount % 100n).padStart(2, '0')}`
      const category = line.categoryId
        ? categories.get(line.categoryId)
        : undefined
      const mainCategory = category?.parentId
        ? categories.get(category.parentId)
        : category
      rows.push(
        [
          transaction.date,
          account.name,
          messages[`csv.kind.${transaction.kind}`],
          transaction.payeeName ?? '',
          mainCategory?.name ?? '',
          category?.parentId ? category.name : '',
        ]
          .map(textCell)
          .concat(
            amountText,
            [
              account.currency,
              line.note || transaction.note,
              line.tags.map((tag) => tag.name).join(','),
              messages[transaction.excluded ? 'csv.yes' : 'csv.no'],
            ].map(textCell),
          )
          .join(delimiter),
      )
    }
  }
  return `\uFEFF${rows.join('\r\n')}\r\n`
}
