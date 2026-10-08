import type { TransactionKind } from './transactions'

export type RecurringSchedule =
  | { type: 'monthly'; day: number; intervalMonths: number }
  | { type: 'weekly'; weekday: number; intervalWeeks: number }
  | { type: 'yearly'; month: number; day: number }

export interface RecurringTransaction {
  id: string
  kind: TransactionKind
  accountId: string
  amountMinor: number
  payeeName: string | null
  categoryId: string | null
  tagIds: string[]
  note: string
  schedule: RecurringSchedule
  startDate: string
  endDate: string | null
  paused: boolean
  generatedThrough: string
  createdAt: string
  updatedAt: string
}

export interface CreateRecurringTransactionInput {
  kind: TransactionKind
  accountId: string
  amountMinor: number
  payeeName?: string | null
  categoryId?: string | null
  tagIds?: string[]
  note?: string
  schedule: RecurringSchedule
  startDate: string
  endDate?: string | null
}

export interface UpdateRecurringTransactionInput extends CreateRecurringTransactionInput {
  id: string
}

export interface RecurringTransactionIdInput {
  id: string
}

export interface PendingTransaction {
  id: string
  recurringId: string
  dueDate: string
  kind: TransactionKind
  accountId: string
  amountMinor: number
  payeeName: string | null
  categoryId: string | null
  tagIds: string[]
  note: string
  createdAt: string
}

const DAY_MS = 24 * 60 * 60 * 1000

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function clampedDate(year: number, month: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return new Date(Date.UTC(year, month - 1, Math.min(day, lastDay)))
}

export function dueDates(
  schedule: RecurringSchedule,
  start: string,
  end: string | null | undefined,
  fromExclusive: string,
  toInclusive: string,
): string[] {
  const startDate = parseDate(start)
  const endDate = end ? parseDate(end) : null
  const fromDate = parseDate(fromExclusive)
  const toDate = parseDate(toInclusive)
  const result: string[] = []
  const include = (candidate: Date) => {
    if (
      candidate >= startDate &&
      candidate > fromDate &&
      candidate <= toDate &&
      (!endDate || candidate <= endDate)
    )
      result.push(formatDate(candidate))
  }

  if (toDate < startDate || (endDate && endDate < startDate)) return result

  if (schedule.type === 'weekly') {
    const daysToWeekday = (schedule.weekday - startDate.getUTCDay() + 7) % 7
    let candidate = new Date(startDate.getTime() + daysToWeekday * DAY_MS)
    const step = schedule.intervalWeeks * 7 * DAY_MS
    while (candidate <= toDate && (!endDate || candidate <= endDate)) {
      include(candidate)
      candidate = new Date(candidate.getTime() + step)
    }
    return result
  }

  if (schedule.type === 'monthly') {
    let index = 0
    while (true) {
      const absoluteMonth =
        startDate.getUTCFullYear() * 12 +
        startDate.getUTCMonth() +
        index * schedule.intervalMonths
      const candidate = clampedDate(
        Math.floor(absoluteMonth / 12),
        (absoluteMonth % 12) + 1,
        schedule.day,
      )
      if (candidate > toDate || (endDate && candidate > endDate)) break
      include(candidate)
      index += 1
    }
    return result
  }

  let year = startDate.getUTCFullYear()
  while (true) {
    const candidate = clampedDate(year, schedule.month, schedule.day)
    if (candidate > toDate || (endDate && candidate > endDate)) break
    include(candidate)
    year += 1
  }
  return result
}
