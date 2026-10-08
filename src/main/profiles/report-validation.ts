import {
  reportPeriods,
  type ReportDateRange,
  type ReportDateRangeInput,
  type ReportPeriod,
} from '../../shared/reports'
import { resolvePresetDateRange } from './period-date-range'

function calendarDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? value
    : undefined
}

function exceedsMaximumRange(from: string, to: string): boolean {
  const yearDifference = Number(to.slice(0, 4)) - Number(from.slice(0, 4))
  return (
    yearDifference > 100 ||
    (yearDifference === 100 && to.slice(4) > from.slice(4))
  )
}

export function parseReportDateRangeInput(
  value: unknown,
): ReportDateRangeInput {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('reports.error.range')
  const input = value as Record<string, unknown>
  if (
    typeof input.period !== 'string' ||
    !reportPeriods.includes(input.period as ReportPeriod)
  )
    throw new Error('reports.error.range')
  const period = input.period as ReportPeriod
  const from = calendarDate(input.from)
  const to = calendarDate(input.to)
  if (
    (period === 'custom' &&
      (!from ||
        !to ||
        from > to ||
        from < '1900-01-01' ||
        exceedsMaximumRange(from, to))) ||
    (period !== 'custom' &&
      (input.from !== undefined || input.to !== undefined))
  )
    throw new Error('reports.error.range')
  return period === 'custom' ? { period, from: from!, to: to! } : { period }
}

export function resolveReportDateRange(
  input: ReportDateRangeInput,
  clock: () => Date,
): ReportDateRange {
  const { period } = input
  if (period === 'custom') return { from: input.from!, to: input.to! }
  return resolvePresetDateRange(period, clock)
}
