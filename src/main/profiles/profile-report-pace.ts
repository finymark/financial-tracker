import type Database from 'better-sqlite3'
import type { ExactBaseCurrencyAmount } from '../../shared/exchange-rates'
import type {
  CategoryBreakdownReport,
  SpendingPaceComparison,
  SpendingPaceMonth,
  SpendingPaceReport,
} from '../../shared/reports'
import { today } from '../../shared/date'
import { getCategoryBreakdown } from './profile-reports'
import { convertToBaseCurrency } from './profile-exchange-rates'

function compare(
  current: SpendingPaceComparison['current'],
  previousMonths: SpendingPaceMonth[],
): SpendingPaceComparison {
  // Reuse conversion's exact totals, never its rounded monthly values.
  let numerator = 0n
  let denominator = 1n
  for (const month of previousMonths) {
    const exact = month.total.exactTotal
    const divisor = BigInt(exact.denominator)
    numerator = numerator * divisor + BigInt(exact.numerator) * denominator
    denominator *= divisor
  }
  denominator *= 3n
  // Reduce the average for the same exact-total representation as conversion.
  let left = numerator
  let right = denominator
  while (right !== 0n) [left, right] = [right, left % right]
  const gcd = left || 1n
  numerator /= gcd
  denominator /= gcd
  const averageExact: ExactBaseCurrencyAmount = {
    numerator: numerator.toString(),
    denominator: denominator.toString(),
  }
  const currentExact = current.exactTotal
  const difference =
    BigInt(currentExact.numerator) * denominator -
    numerator * BigInt(currentExact.denominator)
  const differenceDenominator = BigInt(currentExact.denominator) * denominator
  return {
    current,
    previousMonths,
    average: {
      baseCurrency: current.baseCurrency,
      exactTotal: averageExact,
      roundedMinor: round(numerator, denominator),
      stale: previousMonths.some((month) => month.total.stale),
    },
    differenceMinor: round(difference, differenceDenominator),
    direction:
      difference > 0n ? 'ahead' : difference < 0n ? 'behind' : 'onPace',
    percentageBasisPoints:
      numerator === 0n
        ? null
        : round(
            difference * 10_000n,
            BigInt(currentExact.denominator) * numerator,
          ),
    incomplete:
      current.unconverted.length > 0 ||
      previousMonths.some((month) => month.total.unconverted.length > 0),
  }
}

function round(numerator: bigint, denominator: bigint): number {
  const absolute = numerator < 0n ? -numerator : numerator
  const result = Number(
    (absolute / denominator +
      ((absolute % denominator) * 2n >= denominator ? 1n : 0n)) *
      (numerator < 0n ? -1n : 1n),
  )
  if (!Number.isSafeInteger(result))
    throw new Error('exchangeRates.error.total')
  return result
}

export function getSpendingPace(
  database: Database.Database,
  clock: () => Date,
): SpendingPaceReport {
  const currentDate = today(clock)
  const range = { from: `${currentDate.slice(0, 7)}-01`, to: currentDate }
  const current = getCategoryBreakdown(database, range, clock)
  const day = Number(currentDate.slice(8))
  const previous: CategoryBreakdownReport[] = []
  for (let offset = 1; offset <= 3; offset += 1) {
    const first = new Date(`${range.from}T00:00:00Z`)
    first.setUTCMonth(first.getUTCMonth() - offset)
    const end = new Date(first)
    end.setUTCMonth(end.getUTCMonth() + 1)
    end.setUTCDate(0)
    end.setUTCDate(Math.min(day, end.getUTCDate()))
    previous.push(
      getCategoryBreakdown(
        database,
        {
          from: first.toISOString().slice(0, 10),
          to: end.toISOString().slice(0, 10),
        },
        clock,
      ),
    )
  }
  const empty = convertToBaseCurrency(database, [], clock)
  // Include categories used only in the comparison months as well as current ones.
  const categories = new Map(
    [
      ...current.categories,
      ...previous.flatMap((month) => month.categories),
    ].map((category) => [category.categoryId, category]),
  )
  return {
    range,
    total: compare(
      current.total,
      previous.map((month) => ({ range: month.range, total: month.total })),
    ),
    categories: [...categories.values()].map((category) => ({
      categoryId: category.categoryId,
      name: category.name,
      ...compare(
        current.categories.find(
          (item) => item.categoryId === category.categoryId,
        )?.total ?? empty,
        previous.map((month) => ({
          range: month.range,
          total:
            month.categories.find(
              (item) => item.categoryId === category.categoryId,
            )?.total ?? empty,
        })),
      ),
    })),
  }
}
