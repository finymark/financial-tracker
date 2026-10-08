import { validateOpeningBalance } from './account-validation'
import {
  validateTransactionAccountId,
  validateTransactionDate,
  validateTransactionDateShape,
  validateTransactionId,
  validateTransactionNote,
} from './transaction-validation'

export function validateBalanceAdjustmentId(value: unknown): string {
  try {
    return validateTransactionId(value)
  } catch {
    throw new Error('adjustments.error.notFound')
  }
}

export function validateBalanceAdjustmentAccountId(value: unknown): string {
  try {
    return validateTransactionAccountId(value)
  } catch {
    throw new Error('adjustments.error.account')
  }
}

export function validateBalanceAdjustmentDate(
  value: unknown,
  clock: () => Date,
): string {
  try {
    return validateTransactionDate(value, clock)
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'transactions.error.futureDate'
    ) {
      throw new Error('adjustments.error.futureDate')
    }
    throw new Error('adjustments.error.date')
  }
}

export function validateBalanceAdjustmentDateShape(value: unknown): string {
  try {
    return validateTransactionDateShape(value)
  } catch {
    throw new Error('adjustments.error.date')
  }
}

export function validateObservedBalance(value: unknown): number {
  try {
    return validateOpeningBalance(value)
  } catch {
    throw new Error('adjustments.error.balance')
  }
}

export function validateBalanceAdjustmentNote(value: unknown): string {
  try {
    return validateTransactionNote(value)
  } catch {
    throw new Error('adjustments.error.note')
  }
}
