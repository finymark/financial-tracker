import type Database from 'better-sqlite3'
import type { RenameTagInput, Tag } from '../../shared/tags'
import { normalizePayeeKey } from '../db'
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
      const normalizedName = normalizePayeeKey(name)
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
        .run(before.name, normalizePayeeKey(before.name), before.id)
    },
  }
}

interface DeletedTagImage {
  tag: Tag
  lineIds: string[]
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
      rules: captureCategorisationRules(database),
    }),
    execute: () => {
      const rulesAvailable = Boolean(
        database
          .prepare(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'categorisation_rules'",
          )
          .get(),
      )
      if (rulesAvailable) {
        database
          .prepare(
            `DELETE FROM categorisation_rules
             WHERE category_id IS NULL
               AND 1 = (SELECT COUNT(*) FROM categorisation_rule_tags
                        WHERE rule_id = categorisation_rules.id)
               AND EXISTS (SELECT 1 FROM categorisation_rule_tags
                           WHERE rule_id = categorisation_rules.id AND tag_id = ?)`,
          )
          .run(id)
      }
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
    restoreBefore: ({ tag, lineIds, rules }) => {
      database
        .prepare(
          'INSERT INTO tags (id, name, normalized_name, created_at) VALUES (?, ?, ?, ?)',
        )
        .run(tag.id, tag.name, normalizePayeeKey(tag.name), tag.createdAt)
      const insert = database.prepare(
        'INSERT INTO transaction_line_tags (line_id, tag_id) VALUES (?, ?)',
      )
      for (const lineId of lineIds) insert.run(lineId, tag.id)
      restoreCategorisationRules(database, rules)
    },
  }
}
