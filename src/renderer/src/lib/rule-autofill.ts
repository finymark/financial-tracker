import type { CategorisationAutofill } from '../../../shared/rules'
import type { TransactionTemplate } from '../../../shared/templates'

interface AutofillFields {
  categoryId: string
  tagNames: string[]
}

interface ProtectedAutofillFields {
  category: boolean
  tags: boolean
}

export function templateAutofillProtection(
  template: Pick<TransactionTemplate, 'categoryId' | 'tagNames'>,
): ProtectedAutofillFields {
  // Saved values are explicit choices, just like fields entered by the user.
  return {
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
    categoryId: protectedFields.category
      ? current.categoryId
      : (autofill.categoryId ?? ''),
    tagNames: protectedFields.tags
      ? current.tagNames
      : autofill.tags.map((tag) => tag.name),
  }
}
