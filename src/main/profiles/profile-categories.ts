import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type {
  Category,
  CreateCategoryInput,
  RenameCategoryInput,
  ReorderCategoryInput,
  DeleteCategoryInput,
} from '../../shared/categories'
import {
  validateCategorySortOrder,
  validateCategoryId,
  validateCategoryName,
  validateCategoryKind,
  validateCategoryParent,
} from './category-validation'
import { categoryNames } from '../../shared/category-translations'
import type { Language } from '../../shared/settings'

type StoredCategory = Omit<
  Category,
  'name' | 'archived' | 'hasTransactions'
> & { archived: number }
const columns = `id, kind, seed_key AS seedKey, translation_key AS translationKey,
  custom_name AS customName, parent_id AS parentId, sort_order AS sortOrder, archived`

export function listCategories(
  database: Database.Database,
  language: Language,
): Category[] {
  const rows = database
    .prepare(
      `SELECT ${columns} FROM categories ORDER BY kind, sort_order, rowid`,
    )
    .all() as StoredCategory[]
  // Return main category → subcategories in sibling sort order.
  const ordered = rows
    .filter((category) => category.parentId === null)
    .flatMap((parent) => [
      parent,
      ...rows.filter((child) => child.parentId === parent.id),
    ])
  return ordered.map((category) => ({
    ...category,
    name:
      category.customName ?? categoryNames[language][category.translationKey!],
    archived: Boolean(category.archived),
    hasTransactions: hasCategoryTransactions(database, category.id),
  }))
}

export function getCategory(
  database: Database.Database,
  id: string,
): StoredCategory {
  const category = database
    .prepare(`SELECT ${columns} FROM categories WHERE id = ?`)
    .get(validateCategoryId(id)) as StoredCategory | undefined
  if (!category) throw new Error('categories.error.notFound')
  return category
}

export function createCategory(
  database: Database.Database,
  input: CreateCategoryInput,
): string {
  const name = validateCategoryName(input.name)
  const kind = validateCategoryKind(input.kind)
  const parentId = validateCategoryParent(input.parentId)
  if (parentId !== null) {
    const parent = getCategory(database, parentId)
    if (parent.kind !== kind || parent.parentId !== null || parent.archived) {
      throw new Error('categories.error.parent')
    }
  }
  const nextOrder = database
    .prepare(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM categories WHERE kind = ? AND parent_id IS ?',
    )
    .get(kind, parentId) as { next: number }
  const id = randomUUID()
  database
    .prepare(
      'INSERT INTO categories (id, kind, custom_name, parent_id, sort_order) VALUES (?, ?, ?, ?, ?)',
    )
    .run(id, kind, name, parentId, nextOrder.next)
  return id
}

export function renameCategory(
  database: Database.Database,
  input: RenameCategoryInput,
): string {
  const category = getCategory(database, input.id)
  database
    .prepare('UPDATE categories SET custom_name = ? WHERE id = ?')
    .run(validateCategoryName(input.name), category.id)
  return category.id
}

export function archiveCategory(database: Database.Database, id: string): void {
  const category = getCategory(database, id)
  database
    .prepare('UPDATE categories SET archived = 1 WHERE id = ?')
    .run(category.id)
}

export function reorderCategory(
  database: Database.Database,
  input: ReorderCategoryInput,
): void {
  const category = getCategory(database, input.id)
  const position = validateCategorySortOrder(input.sortOrder)
  const siblings = database
    .prepare(
      'SELECT id FROM categories WHERE kind = ? AND parent_id IS ? ORDER BY sort_order, rowid',
    )
    .all(category.kind, category.parentId) as { id: string }[]
  if (position >= siblings.length) throw new Error('categories.error.order')
  const reordered = siblings.filter((sibling) => sibling.id !== category.id)
  reordered.splice(position, 0, { id: category.id })
  const update = database.prepare(
    'UPDATE categories SET sort_order = ? WHERE id = ?',
  )
  reordered.forEach((sibling, index) => update.run(index, sibling.id))
}

export function hasCategoryTransactions(
  database: Database.Database,
  id: string,
): boolean {
  const category = getCategory(database, id)
  return Boolean(
    database
      .prepare('SELECT 1 FROM transaction_lines WHERE category_id = ? LIMIT 1')
      .get(category.id),
  )
}

export function deleteCategory(
  database: Database.Database,
  input: DeleteCategoryInput,
): void {
  const category = getCategory(database, input.id)
  const used = hasCategoryTransactions(database, category.id)
  if (used && input.replacementId === undefined)
    throw new Error('categories.error.replacementRequired')
  if (input.replacementId !== undefined) {
    const replacement = getCategory(database, input.replacementId)
    const parentArchived =
      replacement.parentId !== null &&
      getCategory(database, replacement.parentId).archived !== 0
    if (
      replacement.id === category.id ||
      replacement.kind !== category.kind ||
      replacement.archived ||
      parentArchived
    ) {
      throw new Error('categories.error.replacement')
    }
  }
  if (
    database
      .prepare('SELECT 1 FROM categories WHERE parent_id = ?')
      .get(category.id)
  ) {
    throw new Error('categories.error.children')
  }
  if (used) {
    database
      .prepare(
        'UPDATE transaction_lines SET category_id = ? WHERE category_id = ?',
      )
      .run(input.replacementId, category.id)
  }
  database.prepare('DELETE FROM categories WHERE id = ?').run(category.id)
}
