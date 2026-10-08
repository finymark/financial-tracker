import type Database from 'better-sqlite3'
import type { Currency } from '../../shared/accounts'
import type { ConversionLine } from '../../shared/exchange-rates'
import type {
  CashFlowNode,
  CashFlowReport,
} from '../../shared/report-cash-flow'
import type { ReportDateRange } from '../../shared/reports'
import type { Language } from '../../shared/settings'
import { listCategories } from './profile-categories'
import { convertToBaseCurrency } from './profile-exchange-rates'

interface CashFlowLine extends ConversionLine {
  kind: 'income' | 'expense'
  categoryId: string | null
}

function safe(value: bigint): number {
  const result = Number(value)
  if (!Number.isSafeInteger(result))
    throw new Error('exchangeRates.error.total')
  return result
}

export function getCashFlow(
  database: Database.Database,
  range: ReportDateRange,
  clock: () => Date,
): CashFlowReport {
  const language = (
    database
      .prepare('SELECT language FROM profile_settings WHERE id = 1')
      .get() as { language: Language }
  ).language
  const categories = listCategories(database, language)
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  )
  const lines = database
    .prepare(
      `SELECT transactions.date, transactions.kind, accounts.currency,
      transaction_lines.amount_minor AS amountMinor,
      transaction_lines.category_id AS categoryId
     FROM transaction_lines
     JOIN transactions ON transactions.id = transaction_lines.transaction_id
     JOIN accounts ON accounts.id = transactions.account_id
     WHERE transactions.kind IN ('income', 'expense')
       AND transactions.excluded = 0
       AND transactions.date >= ? AND transactions.date <= ?`,
    )
    .all(range.from, range.to) as CashFlowLine[]
  const groups = {
    income: new Map<string | null, CashFlowLine[]>(),
    expense: new Map<string | null, CashFlowLine[]>(),
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
  const report: CashFlowReport = {
    range,
    baseCurrency: convertToBaseCurrency(database, [], clock).baseCurrency,
    stale: false,
    unconverted: [],
    nodes: [],
    links: [],
  }
  const unconverted = new Map<Currency, { income: bigint; expense: bigint }>()
  function categoryNodes(kind: 'income' | 'expense'): CashFlowNode[] {
    const nodes: CashFlowNode[] = []
    const mainCategories = categories.filter(
      (category) => category.kind === kind && category.parentId === null,
    )
    for (const main of [...mainCategories, null]) {
      const items = groups[kind].get(main?.id ?? null)
      if (!items) continue
      const total = convertToBaseCurrency(database, items, clock)
      report.stale ||= total.stale
      for (const item of total.unconverted) {
        const amounts = unconverted.get(item.currency) ?? {
          income: 0n,
          expense: 0n,
        }
        amounts[kind] += BigInt(item.amountMinor)
        unconverted.set(item.currency, amounts)
      }
      if (total.roundedMinor > 0)
        nodes.push({
          kind,
          categoryId: main?.id ?? null,
          name: main?.name ?? null,
          value: total.roundedMinor,
        })
    }
    return nodes
  }
  const income = categoryNodes('income')
  const expense = categoryNodes('expense')
  report.unconverted = [...unconverted]
    .map(([currency, amounts]) => ({
      currency,
      incomeMinor: safe(amounts.income),
      expenseMinor: safe(amounts.expense),
    }))
    .sort((left, right) => left.currency.localeCompare(right.currency))
  if (income.length === 0 && expense.length === 0) return report
  const incomeMinor = safe(
    income.reduce((sum, node) => sum + BigInt(node.value), 0n),
  )
  const expenseMinor = safe(
    expense.reduce((sum, node) => sum + BigInt(node.value), 0n),
  )
  // Round category totals once, then reuse them for links. The center and
  // balancing nodes must sum those displayed flows, not round a second total.
  if (expenseMinor > incomeMinor)
    income.push({
      kind: 'deficit',
      categoryId: null,
      name: null,
      value: expenseMinor - incomeMinor,
    })
  if (incomeMinor > expenseMinor)
    expense.push({
      kind: 'surplus',
      categoryId: null,
      name: null,
      value: incomeMinor - expenseMinor,
    })
  const center = income.length
  report.nodes = [
    ...income,
    {
      kind: 'center',
      categoryId: null,
      name: null,
      value: Math.max(incomeMinor, expenseMinor),
    },
    ...expense,
  ]
  report.links = [
    ...income.map((node, source) => ({
      source,
      target: center,
      value: node.value,
    })),
    ...expense.map((node, index) => ({
      source: center,
      target: center + 1 + index,
      value: node.value,
    })),
  ]
  return report
}
