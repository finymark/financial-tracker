import { expect, test } from 'vitest'
import { mergeRuleAutofill } from './rule-autofill'

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
