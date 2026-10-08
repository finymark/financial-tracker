import { currencies, type Currency } from '../../shared/accounts'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function validateAccountId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new Error('accounts.error.notFound')
  }
  return value
}

export function validateAccountName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) {
    throw new Error('accounts.error.name')
  }
  return value.trim()
}

export function validateAccountCurrency(value: unknown): Currency {
  const currency = currencies.find((currency) => currency === value)
  if (!currency) throw new Error('accounts.error.currency')
  return currency
}

export function validateOpeningBalance(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Error('accounts.error.balance')
  }
  return value
}

export function validateOpeningDate(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith('0000')
  ) {
    throw new Error('accounts.error.date')
  }
  const date = new Date(`${value}T00:00:00.000Z`)
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error('accounts.error.date')
  }
  return value
}
