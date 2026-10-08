import type Database from 'better-sqlite3'
import type {
  CreateTemplateInput,
  TransactionTemplate,
  UpdateTemplateInput,
  SaveTransactionAsTemplateInput,
} from '../../shared/templates'
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  saveTransactionAsTemplate,
  storeTemplate,
  updateTemplate,
} from './profile-templates'
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
    execute: () => updateTemplate(database, input, clock),
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
    execute: () => deleteTemplate(database, id),
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
    execute: () => saveTransactionAsTemplate(database, input, clock),
    captureAfter: (result) => result,
    restoreBefore: (_before, after) => {
      database
        .prepare('DELETE FROM transaction_templates WHERE id = ?')
        .run(after.id)
    },
  }
}
