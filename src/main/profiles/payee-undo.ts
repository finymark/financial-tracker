import type Database from 'better-sqlite3'
import type {
  AddPayeeAliasInput,
  MergePayeesInput,
  Payee,
  PayeeAlias,
} from '../../shared/payees'
import {
  addPayeeAlias,
  getPayeeAlias,
  mergePayees,
  removePayeeAlias,
} from './profile-payees'
import type { UndoableCommand } from './undo-history'

export function addPayeeAliasUndoableCommand(
  database: Database.Database,
  input: AddPayeeAliasInput,
  clock: () => Date,
): UndoableCommand<null, PayeeAlias, PayeeAlias> {
  return {
    captureBefore: () => null,
    execute: () => addPayeeAlias(database, input, clock),
    captureAfter: (alias) => alias,
    restoreBefore: (_before, alias) => {
      database.prepare('DELETE FROM payee_aliases WHERE id = ?').run(alias.id)
    },
  }
}

interface StoredAlias extends PayeeAlias {
  normalizedName: string
}

interface StoredPayee extends Payee {
  normalizedName: string
}

interface MergePayeesImage {
  source: StoredPayee
  aliases: StoredAlias[]
  sourceTransactionIds: string[]
}

function insertAlias(database: Database.Database, alias: StoredAlias): void {
  database
    .prepare(
      `INSERT INTO payee_aliases
        (id, payee_id, name, normalized_name, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      alias.id,
      alias.payeeId,
      alias.name,
      alias.normalizedName,
      alias.createdAt,
    )
}

export function removePayeeAliasUndoableCommand(
  database: Database.Database,
  id: string,
): UndoableCommand<StoredAlias, null, void> {
  return {
    captureBefore: () => {
      const alias = getPayeeAlias(database, id)
      const stored = database
        .prepare(
          `SELECT id, payee_id AS payeeId, name,
            normalized_name AS normalizedName, created_at AS createdAt
           FROM payee_aliases WHERE id = ?`,
        )
        .get(alias.id) as StoredAlias
      return stored
    },
    execute: () => removePayeeAlias(database, id),
    captureAfter: () => null,
    restoreBefore: (alias) => insertAlias(database, alias),
  }
}

export function mergePayeesUndoableCommand(
  database: Database.Database,
  input: MergePayeesInput,
  clock: () => Date,
): UndoableCommand<MergePayeesImage, null, Payee> {
  return {
    captureBefore: () => {
      const source = database
        .prepare(
          `SELECT id, name, normalized_name AS normalizedName,
            created_at AS createdAt FROM payees WHERE id = ?`,
        )
        .get(input.sourcePayeeId) as StoredPayee | undefined
      if (!source) throw new Error('payees.error.notFound')
      // Validate the survivor before any write is attempted.
      const survivor = database
        .prepare('SELECT 1 FROM payees WHERE id = ?')
        .get(input.survivorPayeeId)
      if (!survivor) throw new Error('payees.error.notFound')
      if (source.id === input.survivorPayeeId) {
        throw new Error('payees.error.samePayee')
      }
      const aliases = database
        .prepare(
          `SELECT id, payee_id AS payeeId, name,
            normalized_name AS normalizedName, created_at AS createdAt
           FROM payee_aliases
           WHERE payee_id IN (?, ?) ORDER BY rowid`,
        )
        .all(source.id, input.survivorPayeeId) as StoredAlias[]
      const sourceTransactionIds = (
        database
          .prepare(
            'SELECT id FROM transactions WHERE payee_id = ? ORDER BY rowid',
          )
          .all(source.id) as { id: string }[]
      ).map(({ id }) => id)
      return { source, aliases, sourceTransactionIds }
    },
    execute: () => mergePayees(database, input, clock),
    captureAfter: () => null,
    restoreBefore: (before) => {
      database
        .prepare('DELETE FROM payee_aliases WHERE payee_id = ?')
        .run(input.survivorPayeeId)
      database
        .prepare(
          `INSERT INTO payees (id, name, normalized_name, created_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(
          before.source.id,
          before.source.name,
          before.source.normalizedName,
          before.source.createdAt,
        )
      for (const alias of before.aliases) insertAlias(database, alias)
      const restoreTransaction = database.prepare(
        'UPDATE transactions SET payee_id = ? WHERE id = ?',
      )
      for (const transactionId of before.sourceTransactionIds) {
        restoreTransaction.run(before.source.id, transactionId)
      }
    },
  }
}
