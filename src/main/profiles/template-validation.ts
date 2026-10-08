import type {
  CreateTemplateInput,
  TransactionTemplate,
} from '../../shared/templates'
import { UUID_PATTERN } from '../../shared/validation'
import { normalizePayeeKey } from '../db'
import { validateTagNames } from './tag-validation'
import {
  validateTransactionAccountId,
  validateTransactionCategoryId,
  validateTransactionKind,
  validateTransactionNote,
  validateTransactionPayeeName,
  validateTransactionTotal,
} from './transaction-validation'

export function validateTemplateId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value))
    throw new Error('templates.error.notFound')
  return value
}

export function validateTemplateName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100)
    throw new Error('templates.error.name')
  return value.trim()
}

export function templateFields(
  input: CreateTemplateInput | Record<string, unknown>,
): Omit<TransactionTemplate, 'id' | 'createdAt' | 'updatedAt'> {
  const names = validateTagNames(input.tagNames)
  const unique = new Map<string, string>()
  for (const name of names) {
    const key = normalizePayeeKey(name)
    if (!unique.has(key)) unique.set(key, name)
  }
  return {
    name: validateTemplateName(input.name),
    kind: input.kind == null ? null : validateTransactionKind(input.kind),
    accountId:
      input.accountId == null
        ? null
        : validateTransactionAccountId(input.accountId),
    totalMinor:
      input.totalMinor == null
        ? null
        : validateTransactionTotal(input.totalMinor),
    payeeName: validateTransactionPayeeName(input.payeeName),
    categoryId: validateTransactionCategoryId(input.categoryId),
    tagNames: [...unique.values()],
    note: input.note == null ? null : validateTransactionNote(input.note),
  }
}
