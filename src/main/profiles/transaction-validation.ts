import type {
  TransactionExclusionFilter,
  TransactionKind,
  TransactionListInput,
  TransactionPeriod,
} from '../../shared/transactions'
import { validateAccountId } from './account-validation'
import { validateCategoryId, validateCategoryKind } from './category-validation'
import { UUID_PATTERN } from '../../shared/validation'
import { today } from '../../shared/date'

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function validateTransactionId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new Error('transactions.error.notFound')
  }
  return value
}

export function validateTransactionAccountId(value: unknown): string {
  try {
    return validateAccountId(value)
  } catch {
    throw new Error('transactions.error.account')
  }
}

export function validateTransactionKind(value: unknown): TransactionKind {
  try {
    return validateCategoryKind(value)
  } catch {
    throw new Error('transactions.error.kind')
  }
}

export function validateTransactionDate(
  value: unknown,
  clock: () => Date,
): string {
  if (typeof value !== 'string' || !isCalendarDate(value)) {
    throw new Error('transactions.error.date')
  }
  if (value > today(clock)) throw new Error('transactions.error.futureDate')
  return value
}

export function validateTransactionDateShape(value: unknown): string {
  if (typeof value !== 'string' || !isCalendarDate(value)) {
    throw new Error('transactions.error.date')
  }
  return value
}

export function validateTransactionTotal(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new Error('transactions.error.amount')
  }
  return value as number
}

export function validateTransactionPayeeName(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Error('transactions.error.payee')
  const name = value.trim()
  if (name.length === 0) return null
  if (name.length > 100) throw new Error('transactions.error.payee')
  return name
}

export function validateTransactionCategoryId(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  try {
    return validateCategoryId(value)
  } catch {
    throw new Error('transactions.error.category')
  }
}

export function validateTransactionNote(value: unknown): string {
  if (typeof value !== 'string' || value.length > 1000) {
    throw new Error('transactions.error.note')
  }
  return value
}

export function validateTransactionExcluded(
  value: unknown,
): boolean | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') throw new Error('transactions.error.excluded')
  return value
}

export function parseTransactionListInput(
  value: unknown = {},
): TransactionListInput {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('transactions.error.filters')
  const input = value as Record<string, unknown>
  const exclusion = input.exclusion === undefined ? 'all' : input.exclusion
  if (
    typeof exclusion !== 'string' ||
    !['all', 'onlyExcluded', 'hideExcluded'].includes(exclusion)
  )
    throw new Error('transactions.error.filters')
  const period = input.period === undefined ? 'all' : input.period
  if (
    typeof period !== 'string' ||
    !['all', 'thisMonth', 'lastMonth', 'thisYear', 'custom'].includes(period)
  )
    throw new Error('transactions.error.filters')
  const date = (value: unknown): string | undefined => {
    if (value === undefined) return undefined
    if (typeof value !== 'string' || !isCalendarDate(value))
      throw new Error('transactions.error.filters')
    return value
  }
  const from = date(input.from)
  const to = date(input.to)
  if (
    (period === 'custom' && (!from || !to)) ||
    (from && to && from > to) ||
    (period !== 'custom' && (from !== undefined || to !== undefined))
  )
    throw new Error('transactions.error.filters')
  const id = (value: unknown): string | undefined => {
    if (value === undefined) return undefined
    if (typeof value !== 'string' || !UUID_PATTERN.test(value))
      throw new Error('transactions.error.filters')
    return value
  }
  const offset = input.offset === undefined ? 0 : input.offset
  const limit = input.limit === undefined ? 100 : input.limit
  if (
    !Number.isSafeInteger(offset) ||
    (offset as number) < 0 ||
    !Number.isSafeInteger(limit) ||
    (limit as number) < 1 ||
    (limit as number) > 500 ||
    (input.search !== undefined &&
      (typeof input.search !== 'string' || input.search.length > 1000))
  )
    throw new Error('transactions.error.filters')
  return {
    period: period as TransactionPeriod,
    exclusion: exclusion as TransactionExclusionFilter,
    from,
    to,
    accountId: id(input.accountId),
    categoryId: id(input.categoryId),
    payeeId: id(input.payeeId),
    search: (input.search as string | undefined)?.trim(),
    offset: offset as number,
    limit: limit as number,
  }
}
