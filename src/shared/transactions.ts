import type { CategoryKind } from './categories'
import type { Currency } from './accounts'
import type { Tag } from './tags'
import type { Transfer } from './transfers'
import type { BalanceAdjustment } from './adjustments'

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
  tags: Tag[]
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
  excluded: boolean
  createdAt: string
  updatedAt: string
  line: TransactionLine
  linkedTransferId?: string
}

export interface CreateTransactionInput {
  // Omitted names mean no tags on create; supplied names replace the single line's tags.
  tagNames?: string[]
  accountId: string
  kind: TransactionKind
  date: string
  totalMinor: number
  payeeName: string | null
  categoryId: string | null
  note: string
  // Defaults to false on create; omission preserves the flag on update.
  excluded?: boolean
}

// On update, omitted tagNames preserve existing tags; an explicit [] removes them.
export interface UpdateTransactionInput extends CreateTransactionInput {
  id: string
}

export interface TransactionIdInput {
  id: string
}

export type TransactionPeriod =
  'all' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom'

// Transfers and balance adjustments have no exclusion flag: onlyExcluded hides
// both, while hideExcluded retains both. Tag filters hide both (neither has tags).
export type TransactionExclusionFilter = 'all' | 'onlyExcluded' | 'hideExcluded'

// Dates are inclusive and valid only with the custom period. Defaults: all
// dates, all exclusion states, offset 0, limit 100 (maximum 500).
// All supplied filters combine with AND.
export interface TransactionListInput {
  exclusion?: TransactionExclusionFilter
  period?: TransactionPeriod
  from?: string
  to?: string
  accountId?: string
  categoryId?: string
  payeeId?: string
  tagId?: string
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
  rows: (Transaction | Transfer | BalanceAdjustment)[]
  totalCount: number
  // Aggregates cover the entire filtered set, independent of offset/limit,
  // and always omit excluded amounts.
  totals: TransactionTotals[]
  days: TransactionDayTotals[]
}
