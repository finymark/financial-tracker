import type { BaseCurrencyConversion } from './exchange-rates'
import type { CategoryBreakdownCategory, ReportDateRange } from './reports'

export interface OverviewTotals {
  expenses: BaseCurrencyConversion
  incomes: BaseCurrencyConversion
  net: BaseCurrencyConversion
}

export interface OverviewPeriod extends OverviewTotals {
  range: ReportDateRange
}

export interface OverviewTopCategory extends Pick<
  CategoryBreakdownCategory,
  'categoryId' | 'name' | 'total'
> {
  /** Share of converted expenses, rounded to integer basis points. */
  shareBasisPoints: number
}

export interface OverviewDashboard {
  thisMonth: OverviewPeriod
  lastMonth: OverviewPeriod
  /** This month to date minus the full last month, rounded once per total. */
  change: OverviewTotals
  topCategories: OverviewTopCategory[]
}
