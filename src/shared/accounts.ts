export const currencies = ['HUF', 'CHF'] as const
export type Currency = (typeof currencies)[number]

export interface CreateAccountInput {
  name: string
  currency: Currency
  /** Integer hundredths, including HUF. */
  openingBalance: number
  /** Calendar date in YYYY-MM-DD format. */
  openingDate: string
}

export interface Account extends CreateAccountInput {
  id: string
  createdAt: string
  archived: boolean
  balance: number
  hasTransactions: boolean
}

export interface AccountOption {
  id: string
  name: string
  currency: Currency
  archived: boolean
}

export interface AccountIdInput {
  id: string
}

export interface RenameAccountInput extends AccountIdInput {
  name: string
}

export interface ChangeAccountCurrencyInput extends AccountIdInput {
  currency: Currency
}
