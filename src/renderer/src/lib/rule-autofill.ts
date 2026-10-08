import type { CategorisationAutofill } from '../../../shared/rules'
import type { TransactionTemplate } from '../../../shared/templates'

interface AutofillFields {
  payeeName: string
  categoryId: string
  tagNames: string[]
}

export interface ProtectedAutofillFields {
  payee: boolean
  category: boolean
  tags: boolean
}

export function templateAutofillProtection(
  template: Pick<TransactionTemplate, 'categoryId' | 'tagNames' | 'payeeName'>,
): ProtectedAutofillFields {
  // Saved values are explicit choices, just like fields entered by the user.
  return {
    payee: Boolean(template.payeeName),
    category: template.categoryId !== null,
    tags: template.tagNames.length > 0,
  }
}

export function mergeRuleAutofill<Current extends AutofillFields>(
  current: Current,
  autofill: CategorisationAutofill,
  protectedFields: ProtectedAutofillFields,
): Current {
  return {
    ...current,
    payeeName:
      !protectedFields.payee && !current.payeeName && autofill.source === 'rule'
        ? (autofill.payeeName ?? '')
        : current.payeeName,
    categoryId: protectedFields.category
      ? current.categoryId
      : (autofill.categoryId ?? ''),
    tagNames: protectedFields.tags
      ? current.tagNames
      : autofill.tags.map((tag) => tag.name),
  }
}
