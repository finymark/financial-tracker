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

export interface SpendingPaceMonth {
  range: ReportDateRange
  total: BaseCurrencyConversion
}

export interface SpendingPaceComparison {
  current: BaseCurrencyConversion
  previousMonths: SpendingPaceMonth[]
  /** Exact converted sum / 3; unconverted amounts remain in their month buckets. */
  average: Omit<BaseCurrencyConversion, 'unconverted'>
  /** Current minus average, rounded once. Positive means ahead of usual spending. */
  differenceMinor: number
  /** Determined before rounding, even when the displayed difference is zero. */
  direction: 'ahead' | 'behind' | 'onPace'
  /** Signed percentage in hundredths of a percent; null when the exact average is zero. */
  percentageBasisPoints: number | null
  /** One or more months have unconverted amounts, so the comparison is partial. */
  incomplete: boolean
}

export interface SpendingPaceCategory extends SpendingPaceComparison {
  categoryId: string | null
  name: string | null
}

export interface SpendingPaceReport {
  range: ReportDateRange
  total: SpendingPaceComparison
  categories: SpendingPaceCategory[]
}

export interface MonthlyTrendMonth {
  /** ISO calendar month (YYYY-MM), in chronological order. */
  month: string
  /** Only the inclusive days covered by the requested range. */
  range: ReportDateRange
  partial: boolean
  expenses: BaseCurrencyConversion
  incomes: BaseCurrencyConversion
  /** Exact incomes minus expenses, rounded independently once. */
  net: BaseCurrencyConversion
}

export interface MonthlyTrendReport {
  range: ReportDateRange
  months: MonthlyTrendMonth[]
}
