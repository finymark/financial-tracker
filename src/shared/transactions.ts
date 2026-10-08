import type { CategoryKind } from './categories'
import type { Currency } from './accounts'
import type { Tag } from './tags'
import type { Transfer } from './transfers'
export type { Payee } from './payees'
import type { BalanceAdjustment } from './adjustments'
import type { BaseCurrencyTransactionTotals } from './exchange-rates'

export type TransactionKind = CategoryKind

export interface TransactionLine {
  id: string
  amountMinor: number
  categoryId: string | null
  note: string
  tags: Tag[]
}

export interface TransactionLineInput {
  amountMinor: number
  categoryId: string | null
  note: string
  tagNames?: string[]
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
  lines: TransactionLine[]
  // Kept as the first line for compatibility with commands that only support
  // ordinary one-line transactions (notably linked transfer fees).
  line: TransactionLine
  linkedTransferId?: string
}

export interface CreateTransactionInput {
  // When lines is omitted these fields describe one ordinary transaction line.
  // Supplying lines enables a split and each line owns its category, note, and tags.
  tagNames?: string[]
  lines?: TransactionLineInput[]
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
  /** Matches only categoryId itself instead of including its subcategories. */
  exactCategory?: boolean
  /** Matches lines without a category; cannot be combined with categoryId. */
  uncategorized?: boolean
  kind?: TransactionKind
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
  baseTotals: BaseCurrencyTransactionTotals
}
