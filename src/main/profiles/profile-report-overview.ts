import type Database from 'better-sqlite3'
import type {
  ConversionLine,
  ExactBaseCurrencyAmount,
} from '../../shared/exchange-rates'
import type {
  OverviewDashboard,
  OverviewTotals,
} from '../../shared/report-overview'
import { createBaseCurrencyConverter } from './profile-exchange-rates'
import { resolvePresetDateRange } from './period-date-range'
import { getCategoryBreakdown, reportLines } from './profile-reports'

function negate(lines: readonly ConversionLine[]): ConversionLine[] {
  return lines.map((line) => ({ ...line, amountMinor: -line.amountMinor }))
}

function compareExact(
  left: ExactBaseCurrencyAmount,
  right: ExactBaseCurrencyAmount,
): number {
  const difference =
    BigInt(left.numerator) * BigInt(right.denominator) -
    BigInt(right.numerator) * BigInt(left.denominator)
  return difference > 0n ? 1 : difference < 0n ? -1 : 0
}

export function getOverviewDashboard(
  database: Database.Database,
  clock: () => Date,
): OverviewDashboard {
  // Freeze the injected clock for one read snapshot, including a month rollover.
  const now = clock()
  const snapshotClock = () => now
  const thisRange = resolvePresetDateRange('thisMonth', snapshotClock)
  const lastRange = resolvePresetDateRange('lastMonth', snapshotClock)
  const currentLines = reportLines(database, thisRange)
  const previousLines = reportLines(database, lastRange)
  const currentBreakdown = getCategoryBreakdown(
    database,
    thisRange,
    currentLines,
  )
  const linesFor = (lines: ReturnType<typeof reportLines>) => ({
    expenses: lines.filter((line) => line.kind === 'expense'),
    incomes: lines.filter((line) => line.kind === 'income'),
  })
  const current = linesFor(currentLines)
  const previous = linesFor(previousLines)
  const convert = createBaseCurrencyConverter(database, [
    ...currentLines,
    ...previousLines,
  ])
  const totals = (lines: {
    expenses: readonly ConversionLine[]
    incomes: readonly ConversionLine[]
  }): OverviewTotals => ({
    expenses: convert(lines.expenses),
    incomes: convert(lines.incomes),
    net: convert([...lines.incomes, ...negate(lines.expenses)]),
  })
  return {
    thisMonth: {
      range: thisRange,
      ...totals(current),
    },
    lastMonth: {
      range: lastRange,
      ...totals(previous),
    },
    change: totals({
      expenses: [...current.expenses, ...negate(previous.expenses)],
      incomes: [...current.incomes, ...negate(previous.incomes)],
    }),
    topCategories: [...currentBreakdown.categories]
      .sort(
        (left, right) =>
          compareExact(right.total.exactTotal, left.total.exactTotal) ||
          (left.categoryId ?? '').localeCompare(right.categoryId ?? ''),
      )
      .slice(0, 5)
      .map(({ categoryId, name, total, shareBasisPoints }) => ({
        categoryId,
        name,
        total,
        shareBasisPoints,
      })),
  }
}
