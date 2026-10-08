import type {
  CreateRecurringTransactionInput,
  ConfirmPendingTransactionInput,
  RecurringSchedule,
} from '../../shared/recurring'
import { UUID_PATTERN } from '../../shared/validation'
import { validateTagId } from './tag-validation'
import {
  validateTransactionAccountId,
  validateTransactionCategoryId,
  validateTransactionDateShape,
  validateTransactionKind,
  validateTransactionNote,
  validateTransactionPayeeName,
  validateTransactionTotal,
} from './transaction-validation'

export function confirmPendingFields(
  input: Record<string, unknown>,
): ConfirmPendingTransactionInput {
  return {
    id: validatePendingId(input.id),
    ...(input.amountMinor === undefined
      ? {}
      : { amountMinor: validateTransactionTotal(input.amountMinor) }),
    ...(input.date === undefined
      ? {}
      : { date: validateTransactionDateShape(input.date) }),
  }
}

export function validatePendingId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value))
    throw new Error('pending.error.notFound')
  return value
}

export function validateRecurringId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value))
    throw new Error('recurring.error.notFound')
  return value
}

function integerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): number {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < minimum ||
    (value as number) > maximum
  )
    throw new Error('recurring.error.schedule')
  return value as number
}

export function validateRecurringSchedule(value: unknown): RecurringSchedule {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('recurring.error.schedule')
  const schedule = value as Record<string, unknown>
  if (schedule.type === 'monthly')
    return {
      type: 'monthly',
      day: integerInRange(schedule.day, 1, 31),
      intervalMonths: integerInRange(schedule.intervalMonths, 1, 1200),
    }
  if (schedule.type === 'weekly')
    return {
      type: 'weekly',
      weekday: integerInRange(schedule.weekday, 0, 6),
      intervalWeeks: integerInRange(schedule.intervalWeeks, 1, 5200),
    }
  if (schedule.type === 'yearly') {
    const month = integerInRange(schedule.month, 1, 12)
    const day = integerInRange(schedule.day, 1, 31)
    const maximum = new Date(Date.UTC(2000, month, 0)).getUTCDate()
    if (day > maximum) throw new Error('recurring.error.schedule')
    return { type: 'yearly', month, day }
  }
  throw new Error('recurring.error.schedule')
}

export function recurringFields(
  input: CreateRecurringTransactionInput | Record<string, unknown>,
): Omit<
  CreateRecurringTransactionInput,
  'payeeName' | 'categoryId' | 'tagIds' | 'note' | 'endDate'
> & {
  payeeName: string | null
  categoryId: string | null
  tagIds: string[]
  note: string
  endDate: string | null
} {
  const startDate = validateTransactionDateShape(input.startDate)
  const endDate =
    input.endDate == null || input.endDate === ''
      ? null
      : validateTransactionDateShape(input.endDate)
  if (endDate !== null && endDate < startDate)
    throw new Error('recurring.error.dateRange')
  if (input.tagIds !== undefined && !Array.isArray(input.tagIds))
    throw new Error('recurring.error.reference')
  const tagIds = [...new Set((input.tagIds ?? []).map(validateTagId))]
  return {
    kind: validateTransactionKind(input.kind),
    accountId: validateTransactionAccountId(input.accountId),
    amountMinor: validateTransactionTotal(input.amountMinor),
    payeeName: validateTransactionPayeeName(input.payeeName),
    categoryId: validateTransactionCategoryId(input.categoryId),
    tagIds,
    note: validateTransactionNote(input.note ?? ''),
    schedule: validateRecurringSchedule(input.schedule),
    startDate,
    endDate,
  }
}
