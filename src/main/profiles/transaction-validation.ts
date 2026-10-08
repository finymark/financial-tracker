import type { TransactionKind } from '../../shared/transactions'
import { validateAccountId } from './account-validation'
import { validateCategoryId, validateCategoryKind } from './category-validation'

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

export function today(clock: () => Date): string {
  const value = clock()
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function validateTransactionId(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) {
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
