import type {
  CreateTransactionInput,
  Transaction,
  TransactionKind,
} from '../../../../shared/transactions'
import type { Currency } from '../../../../shared/accounts'
import type { Transfer } from '../../../../shared/transfers'
import type { BalanceAdjustment } from '../../../../shared/adjustments'
import { parseAmountExpression } from '../../../../shared/amount-expression'
import { tagKey } from '../../../../shared/text-keys'
import { today } from '../../../../shared/date'
import { amountInput } from '../../lib/amount-input-value'
import type { MessageKey } from '../../i18n'
import { ruleError } from '../rule-editor'

interface CommonForm {
  id: string | null
  date: string
  accountId: string
  amount: string
  note: string
}

export interface TransactionForm extends CommonForm {
  kind: TransactionKind
  payeeName: string
  categoryId: string
  tagNames: string[]
  pendingTagName: string
  excluded: boolean
  splitLines: SplitLineForm[] | null
}

export interface TransferForm extends CommonForm {
  kind: 'transfer'
  toAccountId: string
  toAmount: string
  feeAmount: string
  feeCategoryId: string
  feeExcluded: boolean
}

export interface AdjustmentForm extends CommonForm {
  kind: 'adjustment'
}

export type DrawerForm = TransactionForm | TransferForm | AdjustmentForm
export type RunCommand = (
  action: () => Promise<unknown>,
  offerUndo?: boolean,
  nextForm?: DrawerForm | null,
) => Promise<void>
const errorKeys = [
  'templates.error.name',
  'templates.error.notFound',
  'templates.error.split',
  'transactions.error.account',
  'transactions.error.kind',
  'transactions.error.date',
  'transactions.error.futureDate',
  'transactions.error.amount',
  'transactions.error.payee',
  'transactions.error.category',
  'transactions.error.note',
  'transactions.error.excluded',
  'transactions.error.notFound',
  'transactions.error.lines',
  'transactions.error.filters',
  'transactions.error.totals',
  'tags.error.name',
  'tags.error.notFound',
  'tags.error.duplicate',
  'transfers.error.accountsDiffer',
  'transfers.error.equalAmounts',
  'transfers.error.notFound',
  'transfers.error.linkedFee',
  'adjustments.error.account',
  'adjustments.error.date',
  'adjustments.error.futureDate',
  'adjustments.error.balance',
  'adjustments.error.note',
  'adjustments.error.notFound',
] as const satisfies readonly MessageKey[]

export function transactionError(error: unknown): MessageKey {
  if (String(error).includes('rules.error')) return ruleError(error)
  return (
    errorKeys.find((key) => String(error).includes(key)) ?? 'transactions.error'
  )
}

export interface SplitLineForm {
  key: string
  amount: string
  categoryId: string
  note: string
  tagNames: string[]
  pendingTagName: string
}

let nextSplitLineKey = 0

export function splitLine(
  overrides: Partial<SplitLineForm> = {},
): SplitLineForm {
  nextSplitLineKey += 1
  return {
    key: `split-line-${nextSplitLineKey}`,
    amount: '',
    categoryId: '',
    note: '',
    tagNames: [],
    pendingTagName: '',
    ...overrides,
  }
}

export function emptyForm(accountId = ''): TransactionForm {
  return {
    id: null,
    kind: 'expense',
    date: today(),
    accountId,
    amount: '',
    note: '',
    payeeName: '',
    categoryId: '',
    tagNames: [],
    pendingTagName: '',
    excluded: false,
    splitLines: null,
  }
}

function tagNamesWithPending(
  tagNames: readonly string[],
  pendingTagName: string,
): string[] {
  const pending = pendingTagName.trim()
  return pending ? [...tagNames, pending] : [...tagNames]
}

export function addPendingTag(form: TransactionForm): TransactionForm {
  const name = form.pendingTagName.trim()
  if (!name) return form
  return {
    ...form,
    tagNames: form.tagNames.some((tag) => tagKey(tag) === tagKey(name))
      ? form.tagNames
      : [...form.tagNames, name],
    pendingTagName: '',
  }
}

export function createTransactionInput(
  form: TransactionForm,
  currency: Currency,
): CreateTransactionInput {
  return {
    accountId: form.accountId,
    kind: form.kind,
    date: form.date,
    totalMinor: parseAmountExpression(
      form.amount,
      currency,
      'transactions.error.amount',
    ),
    payeeName: form.payeeName,
    categoryId: form.categoryId || null,
    note: form.note,
    tagNames: tagNamesWithPending(form.tagNames, form.pendingTagName),
    excluded: form.excluded,
    ...(form.splitLines
      ? {
          categoryId: null,
          note: '',
          tagNames: [],
          lines: form.splitLines.map((line) => ({
            amountMinor: parseAmountExpression(
              line.amount,
              currency,
              'transactions.error.amount',
            ),
            categoryId: line.categoryId || null,
            note: line.note,
            tagNames: tagNamesWithPending(line.tagNames, line.pendingTagName),
          })),
        }
      : {}),
  }
}

export function emptyTransferForm(accountId = ''): TransferForm {
  return {
    id: null,
    kind: 'transfer',
    date: today(),
    accountId,
    amount: '',
    note: '',
    toAccountId: '',
    toAmount: '',
    feeAmount: '',
    feeCategoryId: '',
    feeExcluded: false,
  }
}

export function emptyAdjustmentForm(accountId = ''): AdjustmentForm {
  return {
    id: null,
    kind: 'adjustment',
    date: today(),
    accountId,
    amount: '',
    note: '',
  }
}

export function movementForm(
  transaction: Transaction | Transfer | BalanceAdjustment,
): DrawerForm {
  return transaction.kind === 'transfer'
    ? {
        id: transaction.id,
        kind: 'transfer',
        date: transaction.date,
        accountId: transaction.fromAccountId,
        amount: amountInput(transaction.fromAmountMinor),
        note: transaction.note,
        toAccountId: transaction.toAccountId,
        toAmount: amountInput(transaction.toAmountMinor),
        feeAmount: transaction.fee
          ? amountInput(transaction.fee.totalMinor)
          : '',
        feeCategoryId: transaction.fee?.line.categoryId ?? '',
        feeExcluded: transaction.fee?.excluded ?? false,
      }
    : transaction.kind === 'adjustment'
      ? {
          id: transaction.id,
          kind: 'adjustment',
          date: transaction.date,
          accountId: transaction.accountId,
          amount: amountInput(transaction.observedMinor),
          note: transaction.note,
        }
      : {
          id: transaction.id,
          kind: transaction.kind,
          tagNames: transaction.line.tags.map((tag) => tag.name),
          pendingTagName: '',
          date: transaction.date,
          accountId: transaction.accountId,
          amount: amountInput(transaction.totalMinor),
          payeeName: transaction.payeeName ?? '',
          categoryId: transaction.line.categoryId ?? '',
          note: transaction.note,
          excluded: transaction.excluded,
          splitLines:
            transaction.lines.length > 1
              ? transaction.lines.map((line) =>
                  splitLine({
                    amount: amountInput(line.amountMinor),
                    categoryId: line.categoryId ?? '',
                    note: line.note,
                    tagNames: line.tags.map((tag) => tag.name),
                  }),
                )
              : null,
        }
}
