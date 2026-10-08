import type { Currency } from './accounts'

export interface ConversionLine {
  date: string
  currency: Currency
  /** Exact integer hundredths in the line currency. */
  amountMinor: number
}

export interface ExactBaseCurrencyAmount {
  numerator: string
  denominator: string
}

export interface UnconvertedAmount {
  currency: Currency
  amountMinor: number
}

export interface BaseCurrencyConversion {
  baseCurrency: Currency
  exactTotal: ExactBaseCurrencyAmount
  roundedMinor: number
  unconverted: UnconvertedAmount[]
  stale: boolean
}

export interface RateCoverage {
  startDate: string
  endDate: string
}

export interface RateStatus {
  coverage: RateCoverage | null
  lastRefresh: string | null
  stale: boolean
  missing: boolean
}

export interface BaseCurrencyTransactionTotals {
  currency: Currency
  expenseMinor: number
  incomeMinor: number
  unconverted: {
    currency: Currency
    expenseMinor: number
    incomeMinor: number
  }[]
  stale: boolean
}
