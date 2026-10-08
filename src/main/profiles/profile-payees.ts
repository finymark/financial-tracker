import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type {
  AddPayeeAliasInput,
  Payee,
  PayeeAlias,
  PayeeSuggestion,
  PayeeSuggestionInput,
  MergePayeesInput,
} from '../../shared/payees'
import { payeeAliasKey, payeeKey } from '../../shared/text-keys'
import {
  parsePayeeSuggestionInput,
  validatePayeeAliasName,
  validatePayeeAliasId,
  validatePayeeId,
} from './payee-validation'

export function getPayee(database: Database.Database, id: string): Payee {
  const payee = database
    .prepare(
      'SELECT id, name, created_at AS createdAt FROM payees WHERE id = ?',
    )
    .get(validatePayeeId(id)) as Payee | undefined
  if (!payee) throw new Error('payees.error.notFound')
  return payee
}

export function getPayeeAlias(
  database: Database.Database,
  id: string,
): PayeeAlias {
  const alias = database
    .prepare(
      `SELECT id, payee_id AS payeeId, name, created_at AS createdAt
       FROM payee_aliases WHERE id = ?`,
    )
    .get(validatePayeeAliasId(id)) as PayeeAlias | undefined
  if (!alias) throw new Error('payees.error.aliasNotFound')
  return alias
}

export function listPayees(database: Database.Database): Payee[] {
  return database
    .prepare(
      'SELECT id, name, created_at AS createdAt FROM payees ORDER BY name COLLATE NOCASE, rowid',
    )
    .all() as Payee[]
}

export function listPayeeAliases(
  database: Database.Database,
  payeeId: string,
): PayeeAlias[] {
  getPayee(database, payeeId)
  return database
    .prepare(
      `SELECT id, payee_id AS payeeId, name, created_at AS createdAt
       FROM payee_aliases WHERE payee_id = ? ORDER BY name COLLATE NOCASE, rowid`,
    )
    .all(payeeId) as PayeeAlias[]
}

export function suggestPayees(
  database: Database.Database,
  value: PayeeSuggestionInput,
): PayeeSuggestion[] {
  const input = parsePayeeSuggestionInput(value)
  const key = payeeAliasKey(input.query)
  return database
    .prepare(
      `SELECT payees.id, payees.name, payees.created_at AS createdAt,
        COUNT(transactions.id) AS usageCount,
        MAX(transactions.date) AS lastUsedDate
       FROM payees
       JOIN transactions ON transactions.payee_id = payees.id
       WHERE ? = '' OR instr(payee_alias_key(payees.name), ?) > 0
         OR EXISTS (
           SELECT 1 FROM payee_aliases
           WHERE payee_aliases.payee_id = payees.id
             AND instr(payee_aliases.normalized_name, ?) > 0
         )
       GROUP BY payees.id
       ORDER BY usageCount DESC, lastUsedDate DESC,
         payees.name COLLATE NOCASE, payees.rowid
       LIMIT ?`,
    )
    .all(key, key, key, input.limit) as PayeeSuggestion[]
}

export function resolvePayee(
  database: Database.Database,
  name: string | null,
  timestamp: string,
): string | null {
  if (name === null) return null
  const alias = database
    .prepare(
      'SELECT payee_id AS payeeId FROM payee_aliases WHERE normalized_name = ?',
    )
    .get(payeeAliasKey(name)) as { payeeId: string } | undefined
  if (alias) return alias.payeeId
  const existing = database
    .prepare('SELECT id FROM payees WHERE normalized_name = ?')
    .get(payeeKey(name)) as { id: string } | undefined
  if (existing) return existing.id
  const id = randomUUID()
  database
    .prepare(
      'INSERT INTO payees (id, name, normalized_name, created_at) VALUES (?, ?, ?, ?)',
    )
    .run(id, name, payeeKey(name), timestamp)
  return id
}

export function findPayeeByName(
  database: Database.Database,
  name: string | null,
): Payee | null {
  if (name === null) return null
  const alias = database
    .prepare(
      `SELECT payees.id, payees.name, payees.created_at AS createdAt
       FROM payee_aliases
       JOIN payees ON payees.id = payee_aliases.payee_id
       WHERE payee_aliases.normalized_name = ?`,
    )
    .get(payeeAliasKey(name)) as Payee | undefined
  if (alias) return alias
  return (
    (database
      .prepare(
        `SELECT id, name, created_at AS createdAt FROM payees
         WHERE normalized_name = ?`,
      )
      .get(payeeKey(name)) as Payee | undefined) ?? null
  )
}

export function addPayeeAlias(
  database: Database.Database,
  input: AddPayeeAliasInput,
  clock: () => Date,
): PayeeAlias {
  const payeeId = validatePayeeId(input.payeeId)
  getPayee(database, payeeId)
  const name = validatePayeeAliasName(input.name)
  const normalizedName = payeeAliasKey(name)
  const canonicalConflict = database
    .prepare('SELECT id FROM payees WHERE payee_alias_key(name) = ?')
    .get(normalizedName) as { id: string } | undefined
  if (canonicalConflict) throw new Error('payees.error.aliasConflict')
  const id = randomUUID()
  try {
    database
      .prepare(
        `INSERT INTO payee_aliases
          (id, payee_id, name, normalized_name, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, payeeId, name, normalizedName, clock().toISOString())
  } catch (error) {
    if (String(error).includes('UNIQUE constraint failed')) {
      throw new Error('payees.error.aliasConflict', { cause: error })
    }
    throw error
  }
  return database
    .prepare(
      `SELECT id, payee_id AS payeeId, name, created_at AS createdAt
       FROM payee_aliases WHERE id = ?`,
    )
    .get(id) as PayeeAlias
}

export function removePayeeAlias(
  database: Database.Database,
  id: string,
): void {
  const alias = getPayeeAlias(database, id)
  database.prepare('DELETE FROM payee_aliases WHERE id = ?').run(alias.id)
}

export function mergePayees(
  database: Database.Database,
  input: MergePayeesInput,
  clock: () => Date,
): Payee {
  const source = getPayee(database, validatePayeeId(input.sourcePayeeId))
  const survivor = getPayee(database, validatePayeeId(input.survivorPayeeId))
  if (source.id === survivor.id) throw new Error('payees.error.samePayee')

  database
    .prepare('UPDATE transactions SET payee_id = ? WHERE payee_id = ?')
    .run(survivor.id, source.id)
  database
    .prepare('UPDATE payee_aliases SET payee_id = ? WHERE payee_id = ?')
    .run(survivor.id, source.id)
  database
    .prepare('UPDATE categorisation_rules SET payee_id = ? WHERE payee_id = ?')
    .run(survivor.id, source.id)
  database
    .prepare(
      `UPDATE categorisation_rules SET action_payee_id = ?
       WHERE action_payee_id = ?`,
    )
    .run(survivor.id, source.id)
  database.prepare('DELETE FROM payees WHERE id = ?').run(source.id)

  if (payeeKey(source.name) !== payeeKey(survivor.name)) {
    const id = randomUUID()
    try {
      database
        .prepare(
          `INSERT INTO payee_aliases
            (id, payee_id, name, normalized_name, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          survivor.id,
          source.name,
          payeeAliasKey(source.name),
          clock().toISOString(),
        )
    } catch (error) {
      if (String(error).includes('UNIQUE constraint failed')) {
        throw new Error('payees.error.aliasConflict', { cause: error })
      }
      throw error
    }
  }
  return getPayee(database, survivor.id)
}
