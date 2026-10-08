import { today } from '../../shared/date'
import type { ReportDateRange, ReportPeriod } from '../../shared/reports'

type PresetPeriod = Exclude<ReportPeriod, 'custom'>

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

export function resolvePresetDateRange(
  period: PresetPeriod,
  clock: () => Date,
): ReportDateRange {
  const current = today(clock)
  if (period === 'thisMonth')
    return { from: `${current.slice(0, 7)}-01`, to: current }
  if (period === 'thisYear')
    return { from: `${current.slice(0, 4)}-01-01`, to: current }
  if (period === 'lastMonth') {
    const firstOfThisMonth = new Date(`${current.slice(0, 7)}-01T00:00:00Z`)
    const last = new Date(firstOfThisMonth)
    last.setUTCDate(0)
    return { from: `${isoDate(last).slice(0, 7)}-01`, to: isoDate(last) }
  }
  const first = new Date(`${current}T00:00:00Z`)
  first.setUTCFullYear(first.getUTCFullYear() - 1)
  first.setUTCDate(first.getUTCDate() + 1)
  return { from: isoDate(first), to: current }
}
