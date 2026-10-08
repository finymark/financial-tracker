import type { BaseCurrencyConversion } from './exchange-rates'

export const reportPeriods = [
  'thisMonth',
  'lastMonth',
  'thisYear',
  'last12Months',
  'custom',
] as const

export type ReportPeriod = (typeof reportPeriods)[number]

export interface ReportDateRangeInput {
  period: ReportPeriod
  /** Inclusive; required only for a custom period. */
  from?: string
  /** Inclusive; required only for a custom period. */
  to?: string
}

export interface ReportDateRange {
  from: string
  to: string
}

export interface CategoryBreakdownSubcategory {
  /** A main category id denotes lines assigned directly to that main category. */
  categoryId: string
  name: string
  total: BaseCurrencyConversion
}

export interface CategoryBreakdownCategory {
  /** Null is the report's uncategorized group. */
  categoryId: string | null
  /** Null is translated as "Uncategorized" by the renderer. */
  name: string | null
  total: BaseCurrencyConversion
  subcategories: CategoryBreakdownSubcategory[]
}

export interface CategoryBreakdownReport {
  range: ReportDateRange
  total: BaseCurrencyConversion
  categories: CategoryBreakdownCategory[]
}
