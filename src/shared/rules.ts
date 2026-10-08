import type { TransactionKind } from './transactions'
import type { Tag } from './tags'

export interface CategorisationRule {
  id: string
  enabled: boolean
  sortOrder: number
  payeeId: string | null
  payeeName: string | null
  textContains: string | null
  accountId: string | null
  minAmountMinor: number | null
  maxAmountMinor: number | null
  categoryId: string | null
  categoryKind: TransactionKind | null
  tags: Tag[]
  createdAt: string
  updatedAt: string
}

export interface CreateCategorisationRuleInput {
  enabled: boolean
  payeeId: string | null
  textContains: string | null
  accountId: string | null
  minAmountMinor: number | null
  maxAmountMinor: number | null
  categoryId: string | null
  tagIds: string[]
}

export interface UpdateCategorisationRuleInput extends CreateCategorisationRuleInput {
  id: string
}

export interface ReorderCategorisationRuleInput {
  id: string
  sortOrder: number
}

export interface CategorisationRuleIdInput {
  id: string
}

export interface CategorisationRuleDraftInput {
  accountId: string
  kind: TransactionKind
  totalMinor: number | null
  payeeName: string | null
  note: string
}

export interface CategorisationAutofill {
  source: 'rule' | 'lastUsed' | 'none'
  ruleId: string | null
  categoryId: string | null
  tags: Tag[]
}

export interface CategorisationRuleApplicationPreview {
  count: number
}

/** The persistence-free shape consumed by the rule matcher. */
export interface CategorisationRuleMatch {
  id: string
  enabled: boolean
  sortOrder: number
  payeeId: string | null
  textContains: string | null
  accountId: string | null
  minAmountMinor: number | null
  maxAmountMinor: number | null
  categoryId: string | null
  categoryKind: TransactionKind | null
  tagIds: readonly string[]
}

export interface CategorisationRuleDraft {
  accountId: string
  kind: TransactionKind
  totalMinor: number | null
  canonicalPayeeId: string | null
  canonicalPayeeName: string | null
  note: string
}

export function ruleTextKey(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('und')
    .normalize('NFC')
}

export function matchesCategorisationRule(
  rule: CategorisationRuleMatch,
  draft: CategorisationRuleDraft,
): boolean {
  if (!rule.enabled) return false
  if (rule.payeeId === null && rule.textContains === null) return false
  if (rule.payeeId !== null && rule.payeeId !== draft.canonicalPayeeId)
    return false
  if (rule.textContains !== null) {
    const searchedText = ruleTextKey(
      `${draft.canonicalPayeeName ?? ''} ${draft.note}`,
    )
    if (!searchedText.includes(ruleTextKey(rule.textContains))) return false
  }
  if (rule.accountId !== null && rule.accountId !== draft.accountId)
    return false
  if (rule.minAmountMinor !== null) {
    if (draft.totalMinor === null || draft.totalMinor < rule.minAmountMinor)
      return false
  }
  if (rule.maxAmountMinor !== null) {
    if (draft.totalMinor === null || draft.totalMinor > rule.maxAmountMinor)
      return false
  }
  if (rule.categoryKind !== null && rule.categoryKind !== draft.kind)
    return false
  return true
}

/** Rules must be supplied in priority order; the first matching rule wins. */
export function firstMatchingCategorisationRule<
  Rule extends CategorisationRuleMatch,
>(rules: readonly Rule[], draft: CategorisationRuleDraft): Rule | null {
  return rules.find((rule) => matchesCategorisationRule(rule, draft)) ?? null
}
