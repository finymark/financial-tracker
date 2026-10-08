import type { CategoryTranslationKey } from './category-translations'

export const categoryKinds = ['expense', 'income'] as const
export type CategoryKind = (typeof categoryKinds)[number]

export interface Category {
  id: string
  kind: CategoryKind
  seedKey: string | null
  translationKey: CategoryTranslationKey | null
  customName: string | null
  name: string
  parentId: string | null
  sortOrder: number
  archived: boolean
  hasTransactions: boolean
}

export interface CategoryIdInput {
  id: string
}

export interface CreateCategoryInput {
  name: string
  kind: CategoryKind
  parentId?: string | null
}

export interface RenameCategoryInput extends CategoryIdInput {
  name: string
}

export interface ReorderCategoryInput extends CategoryIdInput {
  /** Zero-based position among categories of the same kind and parent. */
  sortOrder: number
}

export interface DeleteCategoryInput extends CategoryIdInput {
  replacementId?: string
}

export interface CategoryOptionsInput {
  kind: CategoryKind
}
