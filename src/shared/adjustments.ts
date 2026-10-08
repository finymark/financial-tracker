export interface BalanceAdjustment {
  id: string
  kind: 'adjustment'
  accountId: string
  date: string
  /** Observed account balance in integer hundredths. */
  observedMinor: number
  /** Recomputed observed balance minus the balance immediately before this adjustment. */
  differenceMinor: number
  note: string
  noLongerCorrectsAnything: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateBalanceAdjustmentInput {
  accountId: string
  date: string
  observedMinor: number
  note: string
}

export interface UpdateBalanceAdjustmentInput extends CreateBalanceAdjustmentInput {
  id: string
}

export interface BalanceAdjustmentIdInput {
  id: string
}
