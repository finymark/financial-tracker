import type Database from 'better-sqlite3'
import type { ConversionLine } from '../../shared/exchange-rates'
import type {
  CategoryBreakdownCategory,
  CategoryBreakdownReport,
  CategoryBreakdownSubcategory,
  ReportDateRange,
} from '../../shared/reports'
import type { Language } from '../../shared/settings'
import { listCategories } from './profile-categories'
import { convertToBaseCurrency } from './profile-exchange-rates'

interface ReportLine extends ConversionLine {
  categoryId: string | null
}

function reportLines(
  database: Database.Database,
  range: ReportDateRange,
): ReportLine[] {
  return database
    .prepare(
      `SELECT transactions.date, accounts.currency,
        transaction_lines.amount_minor AS amountMinor,
        transaction_lines.category_id AS categoryId
       FROM transaction_lines
       JOIN transactions ON transactions.id = transaction_lines.transaction_id
       JOIN accounts ON accounts.id = transactions.account_id
       WHERE transactions.kind = 'expense'
         AND transactions.excluded = 0
         AND transactions.date >= ? AND transactions.date <= ?`,
    )
    .all(range.from, range.to) as ReportLine[]
}

export function getCategoryBreakdown(
  database: Database.Database,
  range: ReportDateRange,
  clock: () => Date,
): CategoryBreakdownReport {
  const language = (
    database
      .prepare('SELECT language FROM profile_settings WHERE id = 1')
      .get() as { language: Language }
  ).language
  const categories = listCategories(database, language).filter(
    (category) => category.kind === 'expense',
  )
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  )
  const lines = reportLines(database, range)
  const mainLines = new Map<string | null, ReportLine[]>()
  const childLines = new Map<string, ReportLine[]>()
  for (const line of lines) {
    const category = line.categoryId
      ? categoryById.get(line.categoryId)
      : undefined
    const mainId = category ? (category.parentId ?? category.id) : null
    mainLines.set(mainId, [...(mainLines.get(mainId) ?? []), line])
    if (category)
      childLines.set(category.id, [
        ...(childLines.get(category.id) ?? []),
        line,
      ])
  }
  const totalFor = (items: readonly ReportLine[]) =>
    convertToBaseCurrency(database, items, clock)
  const result: CategoryBreakdownCategory[] = []
  for (const main of categories.filter(
    (category) => category.parentId === null,
  )) {
    const items = mainLines.get(main.id)
    if (!items) continue
    const subcategories: CategoryBreakdownSubcategory[] = []
    const direct = childLines.get(main.id)
    if (direct)
      subcategories.push({
        categoryId: main.id,
        name: main.name,
        total: totalFor(direct),
      })
    for (const child of categories.filter(
      (category) => category.parentId === main.id,
    )) {
      const childItems = childLines.get(child.id)
      if (childItems)
        subcategories.push({
          categoryId: child.id,
          name: child.name,
          total: totalFor(childItems),
        })
    }
    result.push({
      categoryId: main.id,
      name: main.name,
      total: totalFor(items),
      subcategories,
    })
  }
  const uncategorized = mainLines.get(null)
  if (uncategorized)
    result.push({
      categoryId: null,
      name: null,
      total: totalFor(uncategorized),
      subcategories: [],
    })
  return {
    range,
    total: totalFor(lines),
    categories: result,
  }
}
