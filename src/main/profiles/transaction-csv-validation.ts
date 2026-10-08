import type { TransactionCsvInput } from '../../shared/transaction-csv'
import { inputRecord } from '../ipc'
import { parseTransactionListInput } from './transaction-validation'

export function parseTransactionCsvInput(
  value: unknown = {},
): TransactionCsvInput {
  const input = inputRecord(value)
  if (
    input.decimalSeparator !== undefined &&
    input.decimalSeparator !== '.' &&
    input.decimalSeparator !== ','
  ) {
    throw new Error('csv.error.separator')
  }
  return {
    ...parseTransactionListInput(input),
    decimalSeparator: input.decimalSeparator,
  }
}
