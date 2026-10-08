import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { Currency } from '../../shared/accounts'
import type {
  CreateTransferInput,
  Transfer,
  TransferFeeInput,
  UpdateTransferInput,
} from '../../shared/transfers'
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  getTransactions,
  updateTransaction,
} from './profile-transactions'
import {
  validateTransactionAccountId,
  validateTransactionCategoryId,
  validateTransactionDate,
  validateTransactionId,
  validateTransactionNote,
  validateTransactionTotal,
} from './transaction-validation'

interface StoredTransfer {
  id: string
  fromAccountId: string
  fromAmountMinor: number
  toAccountId: string
  toAmountMinor: number
  date: string
  note: string
  feeTransactionId: string | null
  createdAt: string
  updatedAt: string
  fromCurrency: Currency
  toCurrency: Currency
}

interface ValidatedTransfer {
  fromAccountId: string
  fromAmountMinor: number
  toAccountId: string
  toAmountMinor: number
  date: string
  note: string
  fromCurrency: Currency
  toCurrency: Currency
}

const TRANSFER_SELECT = `
  SELECT transfers.id,
    transfers.from_account_id AS fromAccountId,
    transfers.from_amount_minor AS fromAmountMinor,
    transfers.to_account_id AS toAccountId,
    transfers.to_amount_minor AS toAmountMinor,
    transfers.date,
    transfers.note,
    transfers.fee_transaction_id AS feeTransactionId,
    transfers.created_at AS createdAt,
    transfers.updated_at AS updatedAt,
    from_account.currency AS fromCurrency,
    to_account.currency AS toCurrency
  FROM transfers
  JOIN accounts AS from_account ON from_account.id = transfers.from_account_id
  JOIN accounts AS to_account ON to_account.id = transfers.to_account_id`

function transferView(
  row: StoredTransfer | undefined,
  fee: ReturnType<typeof getTransaction> | null,
): Transfer {
  if (!row) throw new Error('transfers.error.notFound')
  return {
    id: row.id,
    kind: 'transfer',
    fromAccountId: row.fromAccountId,
    fromAmountMinor: row.fromAmountMinor,
    toAccountId: row.toAccountId,
    toAmountMinor: row.toAmountMinor,
    date: row.date,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    actualRate:
      row.fromCurrency === row.toCurrency
        ? null
        : {
            fromCurrency: row.fromCurrency,
            toCurrency: row.toCurrency,
            numerator: row.toAmountMinor,
            denominator: row.fromAmountMinor,
          },
    fee:
      row.feeTransactionId && fee
        ? {
            ...fee,
            linkedTransferId: row.id,
          }
        : null,
  }
}

export function getTransfer(database: Database.Database, id: string): Transfer {
  return getTransfers(database, [validateTransactionId(id)])[0]
}

export function getTransfers(
  database: Database.Database,
  ids: readonly string[],
): Transfer[] {
  if (ids.length === 0) return []
  const rows = database
    .prepare(
      `${TRANSFER_SELECT}
       WHERE transfers.id IN (${ids.map(() => '?').join(',')})`,
    )
    .all(...ids) as StoredTransfer[]
  const feeIds = rows.flatMap((row) =>
    row.feeTransactionId ? [row.feeTransactionId] : [],
  )
  const fees = new Map(
    getTransactions(database, feeIds).map((fee) => [fee.id, fee]),
  )
  const byId = new Map(
    rows.map((row) => [
      row.id,
      transferView(
        row,
        row.feeTransactionId ? (fees.get(row.feeTransactionId) ?? null) : null,
      ),
    ]),
  )
  return ids.map((id) => {
    const transfer = byId.get(id)
    if (!transfer) throw new Error('transfers.error.notFound')
    return transfer
  })
}

function validateTransfer(
  database: Database.Database,
  input: CreateTransferInput,
  clock: () => Date,
  current?: Transfer,
): ValidatedTransfer {
  const fromAccountId = validateTransactionAccountId(input.fromAccountId)
  const toAccountId = validateTransactionAccountId(input.toAccountId)
  if (fromAccountId === toAccountId)
    throw new Error('transfers.error.accountsDiffer')
  const accounts = database
    .prepare('SELECT id, currency, archived FROM accounts WHERE id IN (?, ?)')
    .all(fromAccountId, toAccountId) as {
    id: string
    currency: Currency
    archived: number
  }[]
  const account = (id: string) => {
    const found = accounts.find((candidate) => candidate.id === id)
    const wasUsed = id === current?.fromAccountId || id === current?.toAccountId
    if (!found || (found.archived && !wasUsed))
      throw new Error('transactions.error.account')
    return found
  }
  const from = account(fromAccountId)
  const to = account(toAccountId)
  const fromAmountMinor = validateTransactionTotal(input.fromAmountMinor)
  const toAmountMinor = validateTransactionTotal(input.toAmountMinor)
  if (from.currency === to.currency && fromAmountMinor !== toAmountMinor) {
    throw new Error('transfers.error.equalAmounts')
  }
  return {
    fromAccountId,
    fromAmountMinor,
    toAccountId,
    toAmountMinor,
    date: validateTransactionDate(input.date, clock),
    note: validateTransactionNote(input.note),
    fromCurrency: from.currency,
    toCurrency: to.currency,
  }
}

function feeCategoryId(
  database: Database.Database,
  fee: TransferFeeInput,
): string | null {
  if (fee.categoryId !== undefined)
    return validateTransactionCategoryId(fee.categoryId)
  const category = database
    .prepare(
      `SELECT id FROM categories
       WHERE seed_key = 'expense.fees' AND archived = 0`,
    )
    .get() as { id: string } | undefined
  return category?.id ?? null
}

function feeInput(
  database: Database.Database,
  transfer: ValidatedTransfer,
  fee: TransferFeeInput,
) {
  return {
    accountId: transfer.fromAccountId,
    kind: 'expense' as const,
    date: transfer.date,
    totalMinor: validateTransactionTotal(fee.amountMinor),
    payeeName: null,
    categoryId: feeCategoryId(database, fee),
    note: transfer.note,
    excluded: fee.excluded,
  }
}

export function createTransfer(
  database: Database.Database,
  input: CreateTransferInput,
  clock: () => Date,
): Transfer {
  const transfer = validateTransfer(database, input, clock)
  const timestamp = clock().toISOString()
  const fee = input.fee
    ? createTransaction(
        database,
        feeInput(database, transfer, input.fee),
        clock,
      )
    : null
  const id = randomUUID()
  database
    .prepare(
      `INSERT INTO transfers
        (id, from_account_id, from_amount_minor, to_account_id, to_amount_minor,
          date, note, fee_transaction_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      transfer.fromAccountId,
      transfer.fromAmountMinor,
      transfer.toAccountId,
      transfer.toAmountMinor,
      transfer.date,
      transfer.note,
      fee?.id ?? null,
      timestamp,
      timestamp,
    )
  return getTransfer(database, id)
}

export function updateTransfer(
  database: Database.Database,
  input: UpdateTransferInput,
  clock: () => Date,
): Transfer {
  const current = getTransfer(database, input.id)
  const transfer = validateTransfer(database, input, clock, current)
  const timestamp = clock().toISOString()
  let feeTransactionId = current.fee?.id ?? null
  if (input.fee && current.fee) {
    updateTransaction(
      database,
      {
        id: current.fee.id,
        ...feeInput(database, transfer, input.fee),
      },
      clock,
      true,
    )
  } else if (input.fee) {
    feeTransactionId = createTransaction(
      database,
      feeInput(database, transfer, input.fee),
      clock,
    ).id
  } else if (current.fee) {
    database
      .prepare('UPDATE transfers SET fee_transaction_id = NULL WHERE id = ?')
      .run(current.id)
    deleteTransaction(database, current.fee.id, true)
    feeTransactionId = null
  }
  database
    .prepare(
      `UPDATE transfers SET from_account_id = ?, from_amount_minor = ?,
        to_account_id = ?, to_amount_minor = ?, date = ?, note = ?,
        fee_transaction_id = ?, updated_at = ? WHERE id = ?`,
    )
    .run(
      transfer.fromAccountId,
      transfer.fromAmountMinor,
      transfer.toAccountId,
      transfer.toAmountMinor,
      transfer.date,
      transfer.note,
      feeTransactionId,
      timestamp,
      current.id,
    )
  return getTransfer(database, current.id)
}

export function deleteTransfer(database: Database.Database, id: string): void {
  const current = getTransfer(database, id)
  database.prepare('DELETE FROM transfers WHERE id = ?').run(current.id)
  if (current.fee) deleteTransaction(database, current.fee.id, true)
}
