import type { CreateCategorisationRuleInput } from '../../../shared/rules'
import type { Transaction, TransactionLine } from '../../../shared/transactions'
import { tagKey } from '../../../shared/text-keys'

export interface CategorisationBaseline {
  categoryId: string
  tagNames: string[]
}

export interface ManualCategorisation {
  category: boolean
  tags: boolean
}

/** Use saved identities, not raw payee/inline tag text, for a reusable rule. */
export function ruleOfferPrefill(
  saved: Pick<Transaction, 'kind' | 'payeeId' | 'note'> & {
    lines: Pick<TransactionLine, 'categoryId' | 'tags'>[]
  },
  baseline: CategorisationBaseline,
  manual: ManualCategorisation,
): CreateCategorisationRuleInput | null {
  // A rule has one category action, so cannot reproduce split categorisation.
  if (saved.lines.length !== 1) return null
  const line = saved.lines[0]
  const categoryChanged =
    manual.category && (line.categoryId ?? '') !== baseline.categoryId
  const baselineTags = new Set(baseline.tagNames.map(tagKey))
  const savedTags = new Set(line.tags.map((tag) => tagKey(tag.name)))
  const tagsChanged =
    manual.tags &&
    (baselineTags.size !== savedTags.size ||
      [...savedTags].some((key) => !baselineTags.has(key)))
  if (!categoryChanged && !tagsChanged) return null
  if (!line.categoryId && line.tags.length === 0) return null
  const textContains = saved.payeeId ? null : saved.note.trim() || null
  if (!saved.payeeId && !textContains) return null
  return {
    enabled: true,
    payeeId: saved.payeeId,
    textContains,
    accountId: null,
    minAmountMinor: null,
    maxAmountMinor: null,
    amountCurrency: null,
    actionPayeeId: null,
    categoryId: line.categoryId,
    tagIds: line.tags.map((tag) => tag.id),
  }
}
