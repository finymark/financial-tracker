import type { TransactionListInput } from './transactions'

export type CsvDecimalSeparator = '.' | ','

// Same filters as the transaction list. Paging is accepted but ignored.
export interface TransactionCsvInput extends TransactionListInput {
  decimalSeparator?: CsvDecimalSeparator
}
