import type Database from 'better-sqlite3'
import type {
  ConversionLine,
  ExactBaseCurrencyAmount,
} from '../../shared/exchange-rates'
import type {
  OverviewDashboard,
  OverviewTotals,
} from '../../shared/report-overview'
import type { ReportDateRange } from '../../shared/reports'
import { convertToBaseCurrency } from './profile-exchange-rates'
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

function shareBasisPoints(
  amount: ExactBaseCurrencyAmount,
  total: ExactBaseCurrencyAmount,
): number {
  if (BigInt(total.numerator) === 0n) return 0
  const numerator =
    BigInt(amount.numerator) * BigInt(total.denominator) * 10000n
  const denominator = BigInt(amount.denominator) * BigInt(total.numerator)
  return Number((numerator + denominator / 2n) / denominator)
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
  const currentBreakdown = getCategoryBreakdown(
    database,
    thisRange,
    snapshotClock,
  )
  const previousBreakdown = getCategoryBreakdown(
    database,
    lastRange,
    snapshotClock,
  )
  const linesFor = (range: ReportDateRange) => ({
    expenses: reportLines(database, range),
    incomes: reportLines(database, range, 'income'),
  })
  const current = linesFor(thisRange)
  const previous = linesFor(lastRange)
  const convert = (lines: readonly ConversionLine[]) =>
    convertToBaseCurrency(database, lines, snapshotClock)
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
      expenses: currentBreakdown.total,
    },
    lastMonth: {
      range: lastRange,
      ...totals(previous),
      expenses: previousBreakdown.total,
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
      .map(({ categoryId, name, total }) => ({
        categoryId,
        name,
        total,
        shareBasisPoints: shareBasisPoints(
          total.exactTotal,
          currentBreakdown.total.exactTotal,
        ),
      })),
  }
}
