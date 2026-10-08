import type {
  CategorisationRuleDraftInput,
  CreateCategorisationRuleInput,
  ReorderCategorisationRuleInput,
  UpdateCategorisationRuleInput,
} from '../../shared/rules'
import { UUID_PATTERN } from '../../shared/validation'
import { validateTransactionKind } from './transaction-validation'

export function validateCategorisationRuleId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value))
    throw new Error('rules.error.notFound')
  return value
}

function optionalId(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !UUID_PATTERN.test(value))
    throw new Error('rules.error.reference')
  return value
}

function optionalAmount(value: unknown, allowZero: boolean): number | null {
  if (value === null || value === undefined || value === '') return null
  if (
    !Number.isSafeInteger(value) ||
    (allowZero ? (value as number) < 0 : (value as number) <= 0)
  )
    throw new Error('rules.error.amount')
  return value as number
}

export function parseCategorisationRuleInput(
  value: unknown,
): CreateCategorisationRuleInput {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('rules.error.condition')
  const input = value as Record<string, unknown>
  if (typeof input.enabled !== 'boolean') throw new Error('rules.error.enabled')
  const payeeId = optionalId(input.payeeId)
  const textContains = (() => {
    if (
      input.textContains === null ||
      input.textContains === undefined ||
      input.textContains === ''
    )
      return null
    if (
      typeof input.textContains !== 'string' ||
      !input.textContains.trim() ||
      input.textContains.trim().length > 1000
    )
      throw new Error('rules.error.text')
    return input.textContains.trim()
  })()
  if (payeeId === null && textContains === null)
    throw new Error('rules.error.condition')
  const minAmountMinor = optionalAmount(input.minAmountMinor, true)
  const maxAmountMinor = optionalAmount(input.maxAmountMinor, false)
  if (
    minAmountMinor !== null &&
    maxAmountMinor !== null &&
    minAmountMinor > maxAmountMinor
  )
    throw new Error('rules.error.amountRange')
  if (!Array.isArray(input.tagIds)) throw new Error('rules.error.action')
  const tagIds = [...new Set(input.tagIds.map(optionalId))]
  if (tagIds.includes(null)) throw new Error('rules.error.reference')
  const categoryId = optionalId(input.categoryId)
  if (categoryId === null && tagIds.length === 0)
    throw new Error('rules.error.action')
  return {
    enabled: input.enabled,
    payeeId,
    textContains,
    accountId: optionalId(input.accountId),
    minAmountMinor,
    maxAmountMinor,
    categoryId,
    tagIds: tagIds as string[],
  }
}

export function parseUpdateCategorisationRuleInput(
  value: unknown,
): UpdateCategorisationRuleInput {
  const input = value as Record<string, unknown>
  return {
    id: validateCategorisationRuleId(input?.id),
    ...parseCategorisationRuleInput(value),
  }
}

export function parseReorderCategorisationRuleInput(
  value: unknown,
): ReorderCategorisationRuleInput {
  const input = value as Record<string, unknown>
  if (
    !input ||
    !Number.isSafeInteger(input.sortOrder) ||
    (input.sortOrder as number) < 0
  )
    throw new Error('rules.error.order')
  return {
    id: validateCategorisationRuleId(input.id),
    sortOrder: input.sortOrder as number,
  }
}

export function parseCategorisationRuleDraftInput(
  value: unknown,
): CategorisationRuleDraftInput {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('rules.error.draft')
  const input = value as Record<string, unknown>
  const accountId = optionalId(input.accountId)
  if (accountId === null) throw new Error('rules.error.draft')
  const totalMinor =
    input.totalMinor === null ? null : optionalAmount(input.totalMinor, false)
  if (
    input.payeeName !== null &&
    (typeof input.payeeName !== 'string' || input.payeeName.length > 100)
  )
    throw new Error('rules.error.draft')
  if (typeof input.note !== 'string' || input.note.length > 1000)
    throw new Error('rules.error.draft')
  return {
    accountId,
    kind: validateTransactionKind(input.kind),
    totalMinor,
    payeeName:
      typeof input.payeeName === 'string' && input.payeeName.trim()
        ? input.payeeName.trim()
        : null,
    note: input.note,
  }
}
