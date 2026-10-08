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
  rules: CategorisationRulesImage | null
}

function captureCategories(
  database: Database.Database,
): CategoryAggregateImage {
  return {
    categories: database
      .prepare(
        `SELECT id, kind, seed_key AS seedKey,
          translation_key AS translationKey, custom_name AS customName,
          parent_id AS parentId, sort_order AS sortOrder, archived
         FROM categories ORDER BY parent_id IS NOT NULL, kind, sort_order, rowid`,
      )
      .all() as StoredCategoryImage[],
    lineCategories: database
      .prepare(
        `SELECT id AS lineId, category_id AS categoryId
         FROM transaction_lines WHERE category_id IS NOT NULL ORDER BY id`,
      )
      .all() as { lineId: string; categoryId: string }[],
    templateCategories: database
      .prepare(
        `SELECT id AS templateId, category_id AS categoryId
         FROM transaction_templates WHERE category_id IS NOT NULL ORDER BY id`,
      )
      .all() as { templateId: string; categoryId: string }[],
    rules: captureCategorisationRules(database),
  }
}

function restoreCategories(
  database: Database.Database,
  image: CategoryAggregateImage,
): void {
  database.prepare('DELETE FROM categorisation_rules').run()
  database.prepare('UPDATE transaction_lines SET category_id = NULL').run()
  database.prepare('UPDATE transaction_templates SET category_id = NULL').run()
  database.prepare('DELETE FROM categories WHERE parent_id IS NOT NULL').run()
  database.prepare('DELETE FROM categories').run()
  const insert = database.prepare(
    `INSERT INTO categories
      (id, kind, seed_key, translation_key, custom_name, parent_id,
       sort_order, archived)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
  restoreCategorisationRules(database, image.rules)
}

export function categoryUndoableCommand<Result>(
  database: Database.Database,
  execute: () => Result,
): UndoableCommand<CategoryAggregateImage, CategoryAggregateImage, Result> {
  return {
    captureBefore: () => captureCategories(database),
    execute,
    captureAfter: () => captureCategories(database),
    restoreBefore: (before) => restoreCategories(database, before),
  }
}
