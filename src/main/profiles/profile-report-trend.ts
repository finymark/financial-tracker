import type Database from 'better-sqlite3'
import type {
  MonthlyTrendMonth,
  MonthlyTrendReport,
  ReportDateRange,
} from '../../shared/reports'
import { createBaseCurrencyConverter } from './profile-exchange-rates'
import { monthEnd } from './period-date-range'
import { reportLines } from './profile-reports'

export function getMonthlyTrend(
  database: Database.Database,
  range: ReportDateRange,
): MonthlyTrendReport {
  const lines = reportLines(database, range)
  const convert = createBaseCurrencyConverter(database, lines)
  const byMonth = new Map<string, typeof lines>()
  for (const line of lines) {
    const month = line.date.slice(0, 7)
    const items = byMonth.get(month) ?? []
    items.push(line)
    byMonth.set(month, items)
  }
  const monthIndex = (date: string) =>
    Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1
  const months: MonthlyTrendMonth[] = []
  for (
    let index = monthIndex(range.from);
    index <= monthIndex(range.to);
    index += 1
  ) {
    const month = `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`
    const first = `${month}-01`
    const last = monthEnd(first)
    const from = range.from > first ? range.from : first
    const to = range.to < last ? range.to : last
    const items = byMonth.get(month) ?? []
    months.push({
      month,
      range: { from, to },
      partial: from !== first || to !== last,
      expenses: convert(items.filter((line) => line.kind === 'expense')),
      incomes: convert(items.filter((line) => line.kind === 'income')),
      net: convert(
        items.map((line) => ({
          ...line,
          amountMinor:
            line.kind === 'expense' ? -line.amountMinor : line.amountMinor,
        })),
      ),
    })
  }
  return { range, months }
}
