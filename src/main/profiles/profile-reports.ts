import type Database from 'better-sqlite3'
import type { Category } from '../../shared/categories'
import type {
  ExactBaseCurrencyAmount,
  ConversionLine,
} from '../../shared/exchange-rates'
import { roundHalfAwayFromZero } from '../../shared/exact-math'
import type {
  CategoryBreakdownCategory,
  CategoryBreakdownReport,
  CategoryBreakdownSubcategory,
  ReportDateRange,
} from '../../shared/reports'
import type { Language } from '../../shared/settings'
import { listCategories } from './profile-categories'
import { createBaseCurrencyConverter } from './profile-exchange-rates'

export interface ReportLine extends ConversionLine {
  kind: 'expense' | 'income'
  categoryId: string | null
}

export function reportLines(
  database: Database.Database,
  range: ReportDateRange,
): ReportLine[] {
  return database
    .prepare(
      `SELECT transactions.date, transactions.kind, accounts.currency,
        transaction_lines.amount_minor AS amountMinor,
        transaction_lines.category_id AS categoryId
       FROM transaction_lines
       JOIN transactions ON transactions.id = transaction_lines.transaction_id
       JOIN accounts ON accounts.id = transactions.account_id
       WHERE transactions.kind IN ('expense', 'income')
         AND transactions.excluded = 0
         AND transactions.date >= ? AND transactions.date <= ?`,
    )
    .all(range.from, range.to) as ReportLine[]
}

export function groupReportLinesByMainCategory(
  lines: readonly ReportLine[],
  categories: readonly Category[],
): Record<ReportLine['kind'], Map<string | null, ReportLine[]>> {
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  )
  const groups = {
    income: new Map<string | null, ReportLine[]>(),
    expense: new Map<string | null, ReportLine[]>(),
  }
  for (const line of lines) {
    const category = line.categoryId
      ? categoryById.get(line.categoryId)
      : undefined
    const mainId = category ? (category.parentId ?? category.id) : null
    const group = groups[line.kind].get(mainId) ?? []
    group.push(line)
    groups[line.kind].set(mainId, group)
  }
  return groups
}

export function shareBasisPoints(
  amount: ExactBaseCurrencyAmount,
  total: ExactBaseCurrencyAmount,
): number {
  if (BigInt(total.numerator) === 0n) return 0
  return roundHalfAwayFromZero(
    BigInt(amount.numerator) * BigInt(total.denominator) * 10_000n,
    BigInt(amount.denominator) * BigInt(total.numerator),
    'exchangeRates.error.total',
  )
}

export function getCategoryBreakdown(
  database: Database.Database,
  range: ReportDateRange,
  loadedLines = reportLines(database, range),
): CategoryBreakdownReport {
  const language = (
    database
      .prepare('SELECT language FROM profile_settings WHERE id = 1')
      .get() as { language: Language }
  ).language
  const categories = listCategories(database, language).filter(
    (category) => category.kind === 'expense',
  )
  const expenseLines = loadedLines.filter((line) => line.kind === 'expense')
  const mainLines = groupReportLinesByMainCategory(
    expenseLines,
    categories,
  ).expense
  const childLines = new Map<string, ReportLine[]>()
  for (const line of expenseLines) {
    if (!line.categoryId) continue
    const group = childLines.get(line.categoryId) ?? []
    group.push(line)
    childLines.set(line.categoryId, group)
  }
  const convert = createBaseCurrencyConverter(database, expenseLines)
  const reportTotal = convert(expenseLines)
  const result: CategoryBreakdownCategory[] = []
  for (const main of categories.filter(
    (category) => category.parentId === null,
  )) {
    const items = mainLines.get(main.id)
    if (!items) continue
    const mainTotal = convert(items)
    const subcategories: CategoryBreakdownSubcategory[] = []
    const direct = childLines.get(main.id)
    if (direct) {
      const total = convert(direct)
      subcategories.push({
        categoryId: main.id,
        name: main.name,
        total,
        shareBasisPoints: shareBasisPoints(
          total.exactTotal,
          mainTotal.exactTotal,
        ),
      })
    }
    for (const child of categories.filter(
      (category) => category.parentId === main.id,
    )) {
      const childItems = childLines.get(child.id)
      if (childItems) {
        const total = convert(childItems)
        subcategories.push({
          categoryId: child.id,
          name: child.name,
          total,
          shareBasisPoints: shareBasisPoints(
            total.exactTotal,
            mainTotal.exactTotal,
          ),
        })
      }
    }
    result.push({
      categoryId: main.id,
      name: main.name,
      total: mainTotal,
      shareBasisPoints: shareBasisPoints(
        mainTotal.exactTotal,
        reportTotal.exactTotal,
      ),
      subcategories,
    })
  }
  const uncategorized = mainLines.get(null)
  if (uncategorized) {
    const total = convert(uncategorized)
    result.push({
      categoryId: null,
      name: null,
      total,
      shareBasisPoints: shareBasisPoints(
        total.exactTotal,
        reportTotal.exactTotal,
      ),
      subcategories: [],
    })
  }
  return {
    range,
    total: reportTotal,
    categories: result,
  }
}
