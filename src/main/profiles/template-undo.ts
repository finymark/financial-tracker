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
import { tagKey } from '../../shared/text-keys'

interface TemplateBeforeImage {
  template: TransactionTemplate | null
  existingTagIds: string[]
}
interface TemplateAfterImage {
  id: string
  createdTagIds: string[]
}

function templateCommand(
  database: Database.Database,
  id: string | null,
  names: unknown,
  execute: () => TransactionTemplate,
): UndoableCommand<
  TemplateBeforeImage,
  TemplateAfterImage,
  TransactionTemplate
> {
  return {
    captureBefore: () => ({
      template: id === null ? null : getTemplate(database, id),
      existingTagIds: Array.isArray(names)
        ? names.flatMap((name) => {
            if (typeof name !== 'string') return []
            const tag = database
              .prepare('SELECT id FROM tags WHERE normalized_name = ?')
              .get(tagKey(name.trim())) as { id: string } | undefined
            return tag ? [tag.id] : []
          })
        : [],
    }),
    execute,
    captureAfter: (result, before) => ({
      id: result.id,
      createdTagIds: (
        database
          .prepare(
            'SELECT tag_id AS id FROM transaction_template_tags WHERE template_id = ?',
          )
          .all(result.id) as { id: string }[]
      )
        .map((tag) => tag.id)
        .filter((id) => !before.existingTagIds.includes(id)),
    }),
    restoreBefore: (before, after) => {
      if (before.template) storeTemplate(database, before.template)
      else
        database
          .prepare('DELETE FROM transaction_templates WHERE id = ?')
          .run(after.id)
      const removeUnused = database.prepare(`DELETE FROM tags WHERE id = ?
        AND NOT EXISTS (SELECT 1 FROM transaction_line_tags WHERE tag_id = tags.id)
        AND NOT EXISTS (SELECT 1 FROM transaction_template_tags WHERE tag_id = tags.id)
        AND NOT EXISTS (SELECT 1 FROM categorisation_rule_tags WHERE tag_id = tags.id)`)
      for (const id of after.createdTagIds) removeUnused.run(id)
    },
  }
}

export function createTemplateUndoableCommand(
  database: Database.Database,
  input: CreateTemplateInput,
  clock: () => Date,
) {
  return templateCommand(database, null, input.tagNames, () =>
    createTemplate(database, input, clock),
  )
}

export function updateTemplateUndoableCommand(
  database: Database.Database,
  input: UpdateTemplateInput,
  clock: () => Date,
) {
  return templateCommand(database, input.id, input.tagNames, () =>
    updateTemplate(database, input, clock),
  )
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
  // The source transaction already owns all tags; this command creates none.
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
