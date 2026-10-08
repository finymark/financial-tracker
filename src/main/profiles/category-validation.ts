import { categoryKinds, type CategoryKind } from '../../shared/categories'
import { UUID_PATTERN } from '../../shared/validation'

export function validateCategoryId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new Error('categories.error.notFound')
  }
  return value
}

export function validateCategoryName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) {
    throw new Error('categories.error.name')
  }
  return value.trim()
}

export function validateCategoryKind(value: unknown): CategoryKind {
  const kind = categoryKinds.find((kind) => kind === value)
  if (!kind) throw new Error('categories.error.kind')
  return kind
}

export function validateCategoryParent(value: unknown): string | null {
  return value === null || value === undefined
    ? null
    : validateCategoryId(value)
}

export function validateCategorySortOrder(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error('categories.error.order')
  }
  return value
}
