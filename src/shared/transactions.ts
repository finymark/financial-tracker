import type { CategoryKind } from './categories'
import type { Currency } from './accounts'

export type TransactionKind = CategoryKind

export interface Payee {
  id: string
  name: string
  createdAt: string
}

export interface TransactionLine {
  id: string
  amountMinor: number
  categoryId: string | null
}

export interface Transaction {
  id: string
  accountId: string
  kind: TransactionKind
  date: string
  totalMinor: number
  payeeId: string | null
  payeeName: string | null
  note: string
  createdAt: string
  updatedAt: string
  line: TransactionLine
}

export interface CreateTransactionInput {
  accountId: string
  kind: TransactionKind
  date: string
  totalMinor: number
  payeeName: string | null
  categoryId: string | null
  note: string
}

export interface UpdateTransactionInput extends CreateTransactionInput {
  id: string
}

export interface TransactionIdInput {
  id: string
}

export type TransactionPeriod =
  'all' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom'

// Dates are inclusive and valid only with the custom period. Defaults: all
// dates, offset 0, limit 100 (maximum 500). All supplied filters combine with AND.
export interface TransactionListInput {
  period?: TransactionPeriod
  from?: string
  to?: string
  accountId?: string
  categoryId?: string
  payeeId?: string
  search?: string
  offset?: number
  limit?: number
}

export interface TransactionTotals {
  currency: Currency
  expenseMinor: number
  incomeMinor: number
}

export interface TransactionDayTotals {
  date: string
  totals: TransactionTotals[]
}

export interface TransactionPage {
  rows: Transaction[]
  totalCount: number
  // Aggregates cover the entire filtered set, independent of offset/limit.
  totals: TransactionTotals[]
  days: TransactionDayTotals[]
}
