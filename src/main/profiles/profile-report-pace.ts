import type Database from 'better-sqlite3'
import type { ExactBaseCurrencyAmount } from '../../shared/exchange-rates'
import type {
  CategoryBreakdownReport,
  SpendingPaceComparison,
  SpendingPaceMonth,
  SpendingPaceReport,
} from '../../shared/reports'
import { today } from '../../shared/date'
import {
  addRational,
  rational,
  roundHalfAwayFromZero,
} from '../../shared/exact-math'
import { getCategoryBreakdown } from './profile-reports'
import { convertToBaseCurrency } from './profile-exchange-rates'
import { monthEnd } from './period-date-range'

function compare(
  current: SpendingPaceComparison['current'],
  previousMonths: SpendingPaceMonth[],
): SpendingPaceComparison {
  // Reuse conversion's exact totals, never its rounded monthly values.
  let sum = rational(0n)
  for (const month of previousMonths) {
    const exact = month.total.exactTotal
    sum = addRational(
      sum,
      rational(BigInt(exact.numerator), BigInt(exact.denominator)),
    )
  }
  const average = rational(sum.numerator, sum.denominator * 3n)
  const { numerator, denominator } = average
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
      roundedMinor: roundHalfAwayFromZero(
        numerator,
        denominator,
        'exchangeRates.error.total',
      ),
      stale: previousMonths.some((month) => month.total.stale),
    },
    differenceMinor: roundHalfAwayFromZero(
      difference,
      differenceDenominator,
      'exchangeRates.error.total',
    ),
    direction:
      difference > 0n ? 'ahead' : difference < 0n ? 'behind' : 'onPace',
    percentageBasisPoints:
      numerator === 0n
        ? null
        : roundHalfAwayFromZero(
            difference * 10_000n,
            BigInt(currentExact.denominator) * numerator,
            'exchangeRates.error.total',
          ),
    incomplete:
      current.unconverted.length > 0 ||
      previousMonths.some((month) => month.total.unconverted.length > 0),
  }
}

export function getSpendingPace(
  database: Database.Database,
  clock: () => Date,
): SpendingPaceReport {
  const currentDate = today(clock)
  const range = { from: `${currentDate.slice(0, 7)}-01`, to: currentDate }
  const current = getCategoryBreakdown(database, range)
  const day = Number(currentDate.slice(8))
  const previous: CategoryBreakdownReport[] = []
  for (let offset = 1; offset <= 3; offset += 1) {
    const first = new Date(`${range.from}T00:00:00Z`)
    first.setUTCMonth(first.getUTCMonth() - offset)
    const end = new Date(
      `${monthEnd(first.toISOString().slice(0, 10))}T00:00:00Z`,
    )
    end.setUTCDate(Math.min(day, end.getUTCDate()))
    previous.push(
      getCategoryBreakdown(database, {
        from: first.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
      }),
    )
  }
  const empty = convertToBaseCurrency(database, [])
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
