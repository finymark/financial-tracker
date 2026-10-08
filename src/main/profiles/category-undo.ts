import type Database from 'better-sqlite3'
import type { UndoableCommand } from './undo-history'
import {
  captureCategorisationRules,
  restoreCategorisationRules,
  type CategorisationRulesImage,
} from './rule-undo'

interface StoredCategoryImage {
  id: string
  kind: 'expense' | 'income'
  seedKey: string | null
  translationKey: string | null
  customName: string | null
  parentId: string | null
  sortOrder: number
  archived: number
}

interface CategoryAggregateImage {
  categories: StoredCategoryImage[]
  lineCategories: { lineId: string; categoryId: string }[]
  templateCategories: { templateId: string; categoryId: string }[]
  recurringCategories: { recurringId: string; categoryId: string }[]
  pendingCategories: { pendingId: string; categoryId: string }[]
  rules: CategorisationRulesImage | null
}

type CategoryCommandScope =
  { kind: 'create' } | { kind: 'edit' | 'reorder' | 'delete'; id: string }

function captureCategories(
  database: Database.Database,
  scope: CategoryCommandScope,
): CategoryAggregateImage {
  if (scope.kind === 'create')
    return {
      categories: [],
      lineCategories: [],
      templateCategories: [],
      recurringCategories: [],
      pendingCategories: [],
      rules: null,
    }
  const categories = database
    .prepare(
      `SELECT id, kind, seed_key AS seedKey,
    translation_key AS translationKey, custom_name AS customName,
    parent_id AS parentId, sort_order AS sortOrder, archived FROM categories
    WHERE ${
      scope.kind === 'reorder'
        ? `kind = (SELECT kind FROM categories WHERE id = ?)
      AND parent_id IS (SELECT parent_id FROM categories WHERE id = ?)`
        : 'id = ?'
    }
    ORDER BY sort_order, rowid`,
    )
    .all(
      ...(scope.kind === 'reorder' ? [scope.id, scope.id] : [scope.id]),
    ) as StoredCategoryImage[]
  // Only deletion touches references. Reorder/edit need category rows alone.
  return {
    categories,
    lineCategories:
      scope.kind === 'delete'
        ? (database
            .prepare(
              `SELECT id AS lineId, category_id AS categoryId
      FROM transaction_lines WHERE category_id = ? ORDER BY id`,
            )
            .all(scope.id) as { lineId: string; categoryId: string }[])
        : [],
    templateCategories:
      scope.kind === 'delete'
        ? (database
            .prepare(
              `SELECT id AS templateId, category_id AS categoryId
      FROM transaction_templates WHERE category_id = ? ORDER BY id`,
            )
            .all(scope.id) as { templateId: string; categoryId: string }[])
        : [],
    recurringCategories:
      scope.kind === 'delete'
        ? (database
            .prepare(
              `SELECT id AS recurringId, category_id AS categoryId
               FROM recurring_transactions WHERE category_id = ? ORDER BY id`,
            )
            .all(scope.id) as { recurringId: string; categoryId: string }[])
        : [],
    pendingCategories:
      scope.kind === 'delete'
        ? (database
            .prepare(
              `SELECT id AS pendingId, category_id AS categoryId
               FROM pending_transactions WHERE category_id = ? ORDER BY id`,
            )
            .all(scope.id) as { pendingId: string; categoryId: string }[])
        : [],
    rules:
      scope.kind === 'delete'
        ? captureCategorisationRules(database, scope.id)
        : null,
  }
}

function restoreCategories(
  database: Database.Database,
  image: CategoryAggregateImage,
): void {
  const insert = database.prepare(
    `INSERT INTO categories
      (id, kind, seed_key, translation_key, custom_name, parent_id,
       sort_order, archived)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET kind = excluded.kind,
       seed_key = excluded.seed_key, translation_key = excluded.translation_key,
       custom_name = excluded.custom_name, parent_id = excluded.parent_id,
       sort_order = excluded.sort_order, archived = excluded.archived`,
  )
  for (const category of image.categories) {
    insert.run(
      category.id,
      category.kind,
      category.seedKey,
      category.translationKey,
      category.customName,
      category.parentId,
      category.sortOrder,
      category.archived,
    )
  }
  const restoreLine = database.prepare(
    'UPDATE transaction_lines SET category_id = ? WHERE id = ?',
  )
  for (const association of image.lineCategories)
    restoreLine.run(association.categoryId, association.lineId)
  const restoreTemplate = database.prepare(
    'UPDATE transaction_templates SET category_id = ? WHERE id = ?',
  )
  for (const association of image.templateCategories)
    restoreTemplate.run(association.categoryId, association.templateId)
  const restoreRecurring = database.prepare(
    'UPDATE recurring_transactions SET category_id = ? WHERE id = ?',
  )
  for (const association of image.recurringCategories)
    restoreRecurring.run(association.categoryId, association.recurringId)
  const restorePending = database.prepare(
    'UPDATE pending_transactions SET category_id = ? WHERE id = ?',
  )
  for (const association of image.pendingCategories)
    restorePending.run(association.categoryId, association.pendingId)
  restoreCategorisationRules(database, image.rules, false)
}

export function categoryUndoableCommand<Result>(
  database: Database.Database,
  scope: CategoryCommandScope,
  execute: () => Result,
): UndoableCommand<CategoryAggregateImage, string | null, Result> {
  return {
    captureBefore: () => captureCategories(database, scope),
    execute,
    // Only creation needs an after-image: the identifier to remove on undo.
    captureAfter: (result) =>
      scope.kind === 'create' && typeof result === 'string' ? result : null,
    restoreBefore: (before, createdId) => {
      if (createdId !== null)
        database.prepare('DELETE FROM categories WHERE id = ?').run(createdId)
      restoreCategories(database, before)
    },
  }
}
