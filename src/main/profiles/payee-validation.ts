import type { PayeeSuggestionInput } from '../../shared/payees'
import { UUID_PATTERN } from '../../shared/validation'

export function validatePayeeId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new Error('payees.error.notFound')
  }
  return value
}

export function validatePayeeAliasId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new Error('payees.error.aliasNotFound')
  }
  return value
}

export function validatePayeeAliasName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('payees.error.aliasName')
  const name = value.trim()
  if (name.length < 1 || name.length > 100) {
    throw new Error('payees.error.aliasName')
  }
  return name
}

export function parsePayeeSuggestionInput(
  value: unknown,
): Required<PayeeSuggestionInput> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('payees.error.query')
  }
  const input = value as Record<string, unknown>
  const limit = input.limit === undefined ? 10 : input.limit
  if (
    typeof input.query !== 'string' ||
    input.query.length > 100 ||
    !Number.isSafeInteger(limit) ||
    (limit as number) < 1 ||
    (limit as number) > 50
  ) {
    throw new Error('payees.error.query')
  }
  return { query: input.query.trim(), limit: limit as number }
}
