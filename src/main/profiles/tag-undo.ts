import type Database from 'better-sqlite3'
import type { RenameTagInput, Tag } from '../../shared/tags'
import { tagKey } from '../../shared/text-keys'
import { validateTagId, validateTagName } from './tag-validation'
import type { UndoableCommand } from './undo-history'
import {
  captureCategorisationRules,
  restoreCategorisationRules,
  type CategorisationRulesImage,
} from './rule-undo'

function captureTag(database: Database.Database, id: string): Tag {
  const tag = database
    .prepare('SELECT id, name, created_at AS createdAt FROM tags WHERE id = ?')
    .get(validateTagId(id)) as Tag | undefined
  if (!tag) throw new Error('tags.error.notFound')
  return tag
}

export function renameTagUndoableCommand(
  database: Database.Database,
  input: RenameTagInput,
): UndoableCommand<Tag, Tag, Tag> {
  return {
    captureBefore: () => captureTag(database, input.id),
    execute: () => {
      const name = validateTagName(input.name)
      const normalizedName = tagKey(name)
      const duplicate = database
        .prepare('SELECT id FROM tags WHERE normalized_name = ? AND id <> ?')
        .get(normalizedName, input.id)
      if (duplicate) throw new Error('tags.error.duplicate')
      database
        .prepare('UPDATE tags SET name = ?, normalized_name = ? WHERE id = ?')
        .run(name, normalizedName, input.id)
      return captureTag(database, input.id)
    },
    captureAfter: (result) => result,
    restoreBefore: (before) => {
      database
        .prepare('UPDATE tags SET name = ?, normalized_name = ? WHERE id = ?')
        .run(before.name, tagKey(before.name), before.id)
    },
  }
}

interface DeletedTagImage {
  tag: Tag
  lineIds: string[]
  templateIds: string[]
  recurringIds: string[]
  pendingIds: string[]
  rules: CategorisationRulesImage | null
}

export function deleteTagUndoableCommand(
  database: Database.Database,
  id: string,
): UndoableCommand<DeletedTagImage, Tag | null, void> {
  return {
    captureBefore: () => ({
      tag: captureTag(database, id),
      lineIds: (
        database
          .prepare(
            'SELECT line_id AS lineId FROM transaction_line_tags WHERE tag_id = ? ORDER BY line_id',
          )
          .all(id) as { lineId: string }[]
      ).map((association) => association.lineId),
      templateIds: (
        database
          .prepare(
            `SELECT template_id AS templateId
             FROM transaction_template_tags WHERE tag_id = ?
             ORDER BY template_id`,
          )
          .all(id) as { templateId: string }[]
      ).map((association) => association.templateId),
      recurringIds: (
        database
          .prepare(
            `SELECT recurring_id AS recurringId
             FROM recurring_transaction_tags WHERE tag_id = ?
             ORDER BY recurring_id`,
          )
          .all(id) as { recurringId: string }[]
      ).map((association) => association.recurringId),
      pendingIds: (
        database
          .prepare(
            `SELECT pending_id AS pendingId
             FROM pending_transaction_tags WHERE tag_id = ?
             ORDER BY pending_id`,
          )
          .all(id) as { pendingId: string }[]
      ).map((association) => association.pendingId),
      rules: captureCategorisationRules(database),
    }),
    execute: () => {
      database
        .prepare(
          `DELETE FROM categorisation_rules
             WHERE category_id IS NULL
               AND action_payee_id IS NULL
               AND 1 = (SELECT COUNT(*) FROM categorisation_rule_tags
                        WHERE rule_id = categorisation_rules.id)
               AND EXISTS (SELECT 1 FROM categorisation_rule_tags
                           WHERE rule_id = categorisation_rules.id AND tag_id = ?)`,
        )
        .run(id)
      database.prepare('DELETE FROM tags WHERE id = ?').run(id)
    },
    // Cascading foreign keys remove the associations with the tag; capture the
    // remaining tag image (normally absent) in the original command transaction.
    captureAfter: () =>
      (database
        .prepare(
          'SELECT id, name, created_at AS createdAt FROM tags WHERE id = ?',
        )
        .get(id) as Tag | undefined) ?? null,
    restoreBefore: ({
      tag,
      lineIds,
      templateIds,
      recurringIds,
      pendingIds,
      rules,
    }) => {
      database
        .prepare(
          'INSERT INTO tags (id, name, normalized_name, created_at) VALUES (?, ?, ?, ?)',
        )
        .run(tag.id, tag.name, tagKey(tag.name), tag.createdAt)
      const insert = database.prepare(
        'INSERT INTO transaction_line_tags (line_id, tag_id) VALUES (?, ?)',
      )
      for (const lineId of lineIds) insert.run(lineId, tag.id)
      const insertTemplate = database.prepare(
        `INSERT INTO transaction_template_tags (template_id, tag_id)
         VALUES (?, ?)`,
      )
      for (const templateId of templateIds)
        insertTemplate.run(templateId, tag.id)
      const insertRecurring = database.prepare(
        `INSERT INTO recurring_transaction_tags (recurring_id, tag_id)
         VALUES (?, ?)`,
      )
      for (const recurringId of recurringIds)
        insertRecurring.run(recurringId, tag.id)
      const insertPending = database.prepare(
        `INSERT INTO pending_transaction_tags (pending_id, tag_id)
         VALUES (?, ?)`,
      )
      for (const pendingId of pendingIds) insertPending.run(pendingId, tag.id)
      restoreCategorisationRules(database, rules)
    },
  }
}
