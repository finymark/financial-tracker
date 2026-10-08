import type Database from 'better-sqlite3'

interface Movement {
  date: string
  order: number
  tieBreaker: string
  amountMinor?: number
  adjustmentId?: string
  observedMinor?: number
}

function hasTable(database: Database.Database, name: string): boolean {
  return Boolean(
    database
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(name),
  )
}

function safe(value: bigint): number {
  const number = Number(value)
  if (!Number.isSafeInteger(number)) throw new Error('accounts.error.balance')
  return number
}

/**
 * Walks one account's complete history. On a date, the opening balance is
 * applied first, then transactions and transfer legs, then balance adjustments
 * in creation-timestamp/UUID order. Thus an adjustment observes the account at
 * the end of its day and absorbs movements later entered on that day.
 */
export function calculateAccountHistory(
  database: Database.Database,
  accountId: string,
): { balance: number; adjustmentDifferences: Map<string, number> } {
  const account = database
    .prepare(
      `SELECT opening_balance AS openingBalance, opening_date AS openingDate
       FROM accounts WHERE id = ?`,
    )
    .get(accountId) as
    { openingBalance: number; openingDate: string } | undefined
  if (!account) throw new Error('accounts.error.notFound')

  const movements: Movement[] = [
    {
      date: account.openingDate,
      order: 0,
      tieBreaker: '',
      amountMinor: account.openingBalance,
    },
  ]
  const transactions = database
    .prepare(
      `SELECT id, date,
        CASE kind WHEN 'income' THEN total_minor ELSE -total_minor END AS amountMinor
       FROM transactions WHERE account_id = ?`,
    )
    .all(accountId) as { id: string; date: string; amountMinor: number }[]
  movements.push(
    ...transactions.map((movement) => ({
      date: movement.date,
      order: 1,
      tieBreaker: `transaction:${movement.id}`,
      amountMinor: movement.amountMinor,
    })),
  )

  if (hasTable(database, 'transfers')) {
    const transfers = database
      .prepare(
        `SELECT id, date,
          CASE WHEN from_account_id = ? THEN -from_amount_minor
               ELSE to_amount_minor END AS amountMinor
         FROM transfers
         WHERE from_account_id = ? OR to_account_id = ?`,
      )
      .all(accountId, accountId, accountId) as {
      id: string
      date: string
      amountMinor: number
    }[]
    movements.push(
      ...transfers.map((movement) => ({
        date: movement.date,
        order: 1,
        tieBreaker: `transfer:${movement.id}`,
        amountMinor: movement.amountMinor,
      })),
    )
  }

  if (hasTable(database, 'balance_adjustments')) {
    const adjustments = database
      .prepare(
        `SELECT id, date, observed_minor AS observedMinor,
          created_at AS createdAt
         FROM balance_adjustments WHERE account_id = ?`,
      )
      .all(accountId) as {
      id: string
      date: string
      observedMinor: number
      createdAt: string
    }[]
    movements.push(
      ...adjustments.map((adjustment) => ({
        date: adjustment.date,
        order: 2,
        tieBreaker: `${adjustment.createdAt}:${adjustment.id}`,
        adjustmentId: adjustment.id,
        observedMinor: adjustment.observedMinor,
      })),
    )
  }

  movements.sort((left, right) => {
    const dateOrder =
      left.date < right.date ? -1 : left.date > right.date ? 1 : 0
    if (dateOrder) return dateOrder
    if (left.order !== right.order) return left.order - right.order
    return left.tieBreaker < right.tieBreaker
      ? -1
      : left.tieBreaker > right.tieBreaker
        ? 1
        : 0
  })
  let balance = 0n
  const adjustmentDifferences = new Map<string, number>()
  for (const movement of movements) {
    if (movement.adjustmentId) {
      const observed = BigInt(movement.observedMinor!)
      adjustmentDifferences.set(movement.adjustmentId, safe(observed - balance))
      balance = observed
    } else {
      balance += BigInt(movement.amountMinor!)
    }
  }
  return { balance: safe(balance), adjustmentDifferences }
}
