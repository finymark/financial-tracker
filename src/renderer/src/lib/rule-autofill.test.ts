import { expect, test } from 'vitest'
import { mergeRuleAutofill, templateAutofillProtection } from './rule-autofill'

const autofill = {
  source: 'rule' as const,
  ruleId: 'rule-1',
  categoryId: 'suggested-category',
  tags: [
    { id: 'tag-1', name: 'Suggested', createdAt: '2026-01-15T10:00:00.000Z' },
  ],
}

test('rule autofill never overwrites category or tags the user already changed', () => {
  const current = { categoryId: 'chosen-category', tagNames: ['Chosen'] }
  expect(
    mergeRuleAutofill(current, autofill, { category: true, tags: true }),
  ).toEqual(current)
  expect(
    mergeRuleAutofill(current, autofill, { category: true, tags: false }),
  ).toEqual({ categoryId: 'chosen-category', tagNames: ['Suggested'] })
  expect(
    mergeRuleAutofill(current, autofill, { category: false, tags: true }),
  ).toEqual({ categoryId: 'suggested-category', tagNames: ['Chosen'] })
})

test('template category and tags are protected like user-entered values during rule reevaluation', () => {
  const template = { categoryId: 'template-category', tagNames: ['Template'] }
  const current = { ...template, note: 'Prefilled' }
  const protectedFields = templateAutofillProtection(template)
  expect(protectedFields).toEqual({ category: true, tags: true })
  expect(mergeRuleAutofill(current, autofill, protectedFields)).toEqual(current)
  expect(
    mergeRuleAutofill(
      current,
      { source: 'none', ruleId: null, categoryId: null, tags: [] },
      protectedFields,
    ),
  ).toEqual(current)
})

test.each([
  [
    { categoryId: 'template-category', tagNames: [] },
    { category: true, tags: false },
  ],
  [
    { categoryId: null, tagNames: ['Template'] },
    { category: false, tags: true },
  ],
  [
    { categoryId: null, tagNames: [] },
    { category: false, tags: false },
  ],
])(
  'only omitted template fields remain eligible for rule autofill: %j',
  (template, protection) => {
    expect(templateAutofillProtection(template)).toEqual(protection)
    const current = {
      categoryId: template.categoryId ?? '',
      tagNames: template.tagNames,
    }
    expect(mergeRuleAutofill(current, autofill, protection)).toEqual({
      categoryId: protection.category
        ? current.categoryId
        : autofill.categoryId,
      tagNames: protection.tags ? current.tagNames : ['Suggested'],
    })
  },
)
