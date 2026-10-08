import type { CategorisationAutofill } from '../../../shared/rules'

interface AutofillFields {
  categoryId: string
  tagNames: string[]
}

interface ProtectedAutofillFields {
  category: boolean
  tags: boolean
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
