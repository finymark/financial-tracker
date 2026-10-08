import type Database from 'better-sqlite3'
import type {
  CreateTemplateInput,
  TransactionTemplate,
  UpdateTemplateInput,
  SaveTransactionAsTemplateInput,
} from '../../shared/templates'
import {
  createTemplate,
  getTemplate,
  storeTemplate,
  validateTemplateReferences,
} from './profile-templates'
import { templateFields } from './template-validation'
import { getTransaction } from './profile-transactions'
import { validateTransactionId } from './transaction-validation'
import type { UndoableCommand } from './undo-history'

export function createTemplateUndoableCommand(
  database: Database.Database,
  input: CreateTemplateInput,
  clock: () => Date,
): UndoableCommand<null, TransactionTemplate, TransactionTemplate> {
  return {
    captureBefore: () => null,
    execute: () => createTemplate(database, input, clock),
    captureAfter: (result) => result,
    restoreBefore: (_before, after) => {
      database
        .prepare('DELETE FROM transaction_templates WHERE id = ?')
        .run(after.id)
    },
  }
}

export function updateTemplateUndoableCommand(
  database: Database.Database,
  input: UpdateTemplateInput,
  clock: () => Date,
): UndoableCommand<
  TransactionTemplate,
  TransactionTemplate,
  TransactionTemplate
> {
  return {
    captureBefore: () => getTemplate(database, input.id),
    execute: () => {
      const current = getTemplate(database, input.id)
      const template = {
        ...current,
        ...templateFields(input),
        updatedAt: clock().toISOString(),
      }
      validateTemplateReferences(database, template)
      storeTemplate(database, template)
      return getTemplate(database, input.id)
    },
    captureAfter: (result) => result,
    restoreBefore: (before) => storeTemplate(database, before),
  }
}

export function deleteTemplateUndoableCommand(
  database: Database.Database,
  id: string,
): UndoableCommand<TransactionTemplate, null, void> {
  return {
    captureBefore: () => getTemplate(database, id),
    execute: () => {
      database.prepare('DELETE FROM transaction_templates WHERE id = ?').run(id)
    },
    captureAfter: () => null,
    restoreBefore: (before) => storeTemplate(database, before),
  }
}

export function saveTransactionAsTemplateUndoableCommand(
  database: Database.Database,
  input: SaveTransactionAsTemplateInput,
  clock: () => Date,
): UndoableCommand<null, TransactionTemplate, TransactionTemplate> {
  return {
    captureBefore: () => null,
    execute: () => {
      const source = getTransaction(
        database,
        validateTransactionId(input.transactionId),
      )
      return createTemplate(
        database,
        {
          name: input.name,
          kind: source.kind,
          accountId: source.accountId,
          totalMinor: source.totalMinor,
          payeeName: source.payeeName,
          categoryId: source.line.categoryId,
          tagNames: source.line.tags.map((tag) => tag.name),
          note: source.note,
        },
        clock,
      )
    },
    captureAfter: (result) => result,
    restoreBefore: (_before, after) => {
      database
        .prepare('DELETE FROM transaction_templates WHERE id = ?')
        .run(after.id)
    },
  }
}
