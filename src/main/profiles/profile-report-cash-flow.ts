import type Database from 'better-sqlite3'
import type { Currency } from '../../shared/accounts'
import { safeInteger } from '../../shared/exact-math'
import type {
  CashFlowNode,
  CashFlowReport,
} from '../../shared/report-cash-flow'
import type { ReportDateRange } from '../../shared/reports'
import type { Language } from '../../shared/settings'
import { listCategories } from './profile-categories'
import {
  baseCurrency,
  createBaseCurrencyConverter,
} from './profile-exchange-rates'
import { groupReportLinesByMainCategory, reportLines } from './profile-reports'

export function getCashFlow(
  database: Database.Database,
  range: ReportDateRange,
): CashFlowReport {
  const language = (
    database
      .prepare('SELECT language FROM profile_settings WHERE id = 1')
      .get() as { language: Language }
  ).language
  const categories = listCategories(database, language)
  const lines = reportLines(database, range)
  const groups = groupReportLinesByMainCategory(lines, categories)
  const convert = createBaseCurrencyConverter(database, lines)
  const report: CashFlowReport = {
    range,
    baseCurrency: baseCurrency(database),
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
      const total = convert(items)
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
      incomeMinor: safeInteger(amounts.income, 'exchangeRates.error.total'),
      expenseMinor: safeInteger(amounts.expense, 'exchangeRates.error.total'),
    }))
    .sort((left, right) => left.currency.localeCompare(right.currency))
  if (income.length === 0 && expense.length === 0) return report
  const incomeMinor = safeInteger(
    income.reduce((sum, node) => sum + BigInt(node.value), 0n),
    'exchangeRates.error.total',
  )
  const expenseMinor = safeInteger(
    expense.reduce((sum, node) => sum + BigInt(node.value), 0n),
    'exchangeRates.error.total',
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
