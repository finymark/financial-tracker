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
  const current = {
    payeeName: '',
    categoryId: 'chosen-category',
    tagNames: ['Chosen'],
  }
  expect(
    mergeRuleAutofill(current, autofill, {
      payee: false,
      category: true,
      tags: true,
    }),
  ).toEqual(current)
  expect(
    mergeRuleAutofill(current, autofill, {
      payee: false,
      category: true,
      tags: false,
    }),
  ).toEqual({
    payeeName: '',
    categoryId: 'chosen-category',
    tagNames: ['Suggested'],
  })
  expect(
    mergeRuleAutofill(current, autofill, {
      payee: false,
      category: false,
      tags: true,
    }),
  ).toEqual({
    payeeName: '',
    categoryId: 'suggested-category',
    tagNames: ['Chosen'],
  })
})

test('template category and tags are protected like user-entered values during rule reevaluation', () => {
  const template = {
    payeeName: '',
    categoryId: 'template-category',
    tagNames: ['Template'],
  }
  const current = { ...template, note: 'Prefilled' }
  const protectedFields = templateAutofillProtection(template)
  expect(protectedFields).toEqual({ payee: false, category: true, tags: true })
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
    { payeeName: '', categoryId: 'template-category', tagNames: [] },
    { payee: false, category: true, tags: false },
  ],
  [
    { payeeName: null, categoryId: null, tagNames: ['Template'] },
    { payee: false, category: false, tags: true },
  ],
  [
    { payeeName: null, categoryId: null, tagNames: [] },
    { payee: false, category: false, tags: false },
  ],
])(
  'only omitted template fields remain eligible for rule autofill: %j',
  (template, protection) => {
    expect(templateAutofillProtection(template)).toEqual(protection)
    const current = {
      payeeName: template.payeeName ?? '',
      categoryId: template.categoryId ?? '',
      tagNames: template.tagNames,
    }
    expect(mergeRuleAutofill(current, autofill, protection)).toEqual({
      payeeName: current.payeeName,
      categoryId: protection.category
        ? current.categoryId
        : autofill.categoryId,
      tagNames: protection.tags ? current.tagNames : ['Suggested'],
    })
  },
)

test('a rule payee action fills only an empty untouched payee', () => {
  const action = { ...autofill, payeeName: 'Rule payee' }
  const protection = { payee: false, category: false, tags: false }
  expect(
    mergeRuleAutofill(
      { payeeName: '', categoryId: '', tagNames: [] },
      action,
      protection,
    ).payeeName,
  ).toBe('Rule payee')
  expect(
    mergeRuleAutofill(
      { payeeName: 'Typed', categoryId: '', tagNames: [] },
      action,
      protection,
    ).payeeName,
  ).toBe('Typed')
  expect(
    mergeRuleAutofill({ payeeName: '', categoryId: '', tagNames: [] }, action, {
      ...protection,
      payee: true,
    }).payeeName,
  ).toBe('')
  expect(
    mergeRuleAutofill(
      { payeeName: '', categoryId: '', tagNames: [] },
      { ...action, source: 'lastUsed' },
      protection,
    ).payeeName,
  ).toBe('')
})

test('a template payee is protected from later rule payee actions', () => {
  expect(
    templateAutofillProtection({
      payeeName: 'Template',
      categoryId: null,
      tagNames: [],
    }).payee,
  ).toBe(true)
})
