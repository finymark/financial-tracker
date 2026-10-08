import type { Currency } from './accounts'
import type { BaseCurrencyTransactionTotals } from './exchange-rates'
import type { ReportDateRange } from './reports'

export interface CashFlowNode {
  kind: 'income' | 'expense' | 'center' | 'deficit' | 'surplus'
  /** Null for uncategorized groups and balancing nodes. */
  categoryId: string | null
  /** Category names are localized by the application; other labels by the renderer. */
  name: string | null
  /** Integer hundredths of the base currency, shared with the connecting link. */
  value: number
}

export interface CashFlowLink {
  /** Index into nodes. */
  source: number
  /** Index into nodes. */
  target: number
  value: number
}

export interface CashFlowReport {
  range: ReportDateRange
  baseCurrency: Currency
  stale: boolean
  unconverted: BaseCurrencyTransactionTotals['unconverted']
  nodes: CashFlowNode[]
  links: CashFlowLink[]
}
