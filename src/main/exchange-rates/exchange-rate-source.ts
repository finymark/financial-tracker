import type { Currency } from '../../shared/accounts'

export interface ExchangeRate {
  date: string
  currency: Currency
  /** Decimal string as quoted by the source; never a binary float. */
  rate: string
  unit: number
}

export interface ExchangeRateRequest {
  startDate: string
  endDate: string
  currencies: readonly Currency[]
}

export interface ExchangeRateSource {
  fetchRates(input: ExchangeRateRequest): Promise<ExchangeRate[]>
}
