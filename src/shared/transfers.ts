import type { Currency } from './accounts'
import type { Transaction } from './transactions'

export interface TransferFeeInput {
  amountMinor: number
  /** Omit to use the active seeded Fees category; null keeps it uncategorized. */
  categoryId?: string | null
}

export interface CreateTransferInput {
  fromAccountId: string
  fromAmountMinor: number
  toAccountId: string
  toAmountMinor: number
  date: string
  note: string
  fee: TransferFeeInput | null
}

export interface UpdateTransferInput extends CreateTransferInput {
  id: string
}

export interface TransferIdInput {
  id: string
}

export interface TransferActualRate {
  fromCurrency: Currency
  toCurrency: Currency
  /** Exact to-account amount in integer hundredths. */
  numerator: number
  /** Exact from-account amount in integer hundredths. */
  denominator: number
}

export interface Transfer {
  id: string
  kind: 'transfer'
  fromAccountId: string
  fromAmountMinor: number
  toAccountId: string
  toAmountMinor: number
  date: string
  note: string
  createdAt: string
  updatedAt: string
  actualRate: TransferActualRate | null
  fee: Transaction | null
}
