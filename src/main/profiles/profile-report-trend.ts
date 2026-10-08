import type Database from 'better-sqlite3'
import type { ConversionLine } from '../../shared/exchange-rates'
import type {
  MonthlyTrendMonth,
  MonthlyTrendReport,
  ReportDateRange,
} from '../../shared/reports'
import { convertToBaseCurrency } from './profile-exchange-rates'

interface TrendLine extends ConversionLine {
  kind: 'expense' | 'income'
}

export function getMonthlyTrend(
  database: Database.Database,
  range: ReportDateRange,
  clock: () => Date,
): MonthlyTrendReport {
  const lines = database
    .prepare(
      `SELECT transactions.date, transactions.kind, accounts.currency,
        transaction_lines.amount_minor AS amountMinor
       FROM transaction_lines
       JOIN transactions ON transactions.id = transaction_lines.transaction_id
       JOIN accounts ON accounts.id = transactions.account_id
       WHERE transactions.kind IN ('expense', 'income')
         AND transactions.excluded = 0
         AND transactions.date >= ? AND transactions.date <= ?`,
    )
    .all(range.from, range.to) as TrendLine[]
  const byMonth = new Map<string, TrendLine[]>()
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
    const lastDate = new Date(`${first}T00:00:00Z`)
    lastDate.setUTCMonth(lastDate.getUTCMonth() + 1, 0)
    const last = lastDate.toISOString().slice(0, 10)
    const from = range.from > first ? range.from : first
    const to = range.to < last ? range.to : last
    const items = byMonth.get(month) ?? []
    months.push({
      month,
      range: { from, to },
      partial: from !== first || to !== last,
      expenses: convertToBaseCurrency(
        database,
        items.filter((line) => line.kind === 'expense'),
        clock,
      ),
      incomes: convertToBaseCurrency(
        database,
        items.filter((line) => line.kind === 'income'),
        clock,
      ),
      net: convertToBaseCurrency(
        database,
        items.map((line) => ({
          ...line,
          amountMinor:
            line.kind === 'expense' ? -line.amountMinor : line.amountMinor,
        })),
        clock,
      ),
    })
  }
  return { range, months }
}
