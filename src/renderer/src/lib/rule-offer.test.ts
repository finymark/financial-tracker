import { expect, test } from 'vitest'
import { ruleOfferPrefill } from './rule-offer'

const tag = {
  id: 'tag-1',
  name: 'Travel',
  createdAt: '2026-01-15T10:00:00.000Z',
}
const saved = {
  kind: 'expense' as const,
  payeeId: 'payee-1',
  note: 'Train ticket',
  lines: [{ categoryId: 'category-1', tags: [tag] }],
}
const baseline = { categoryId: '', tagNames: [] as string[] }
const manual = { category: true, tags: false }

test('manual category offers the canonical payee condition and persisted actions', () => {
  expect(ruleOfferPrefill(saved, baseline, manual)).toEqual({
    enabled: true,
    payeeId: 'payee-1',
    textContains: null,
    accountId: null,
    minAmountMinor: null,
    maxAmountMinor: null,
    amountCurrency: null,
    actionPayeeId: null,
    categoryId: 'category-1',
    tagIds: ['tag-1'],
  })
})

test('manual tags on income offer note-contains when there is no payee', () => {
  expect(
    ruleOfferPrefill(
      {
        ...saved,
        kind: 'income',
        payeeId: null,
        note: '  Salary  ',
        lines: [{ categoryId: null, tags: [tag] }],
      },
      baseline,
      { category: false, tags: true },
    ),
  ).toMatchObject({
    payeeId: null,
    textContains: 'Salary',
    categoryId: null,
    tagIds: ['tag-1'],
  })
})

test('autofill without a manual edit does not offer a rule', () => {
  expect(
    ruleOfferPrefill(saved, baseline, { category: false, tags: false }),
  ).toBeNull()
})

test('unchanged template, duplicate and edit values do not offer a rule', () => {
  const prefill = { categoryId: 'category-1', tagNames: ['Travel'] }
  expect(
    ruleOfferPrefill(saved, prefill, { category: false, tags: false }),
  ).toBeNull()
  expect(
    ruleOfferPrefill(saved, prefill, { category: true, tags: true }),
  ).toBeNull()
  expect(
    ruleOfferPrefill(
      saved,
      { ...prefill, tagNames: ['TRAVEL'] },
      { category: false, tags: true },
    ),
  ).toBeNull()
})

test('changing template, duplicate or autofill values by hand offers a rule', () => {
  expect(
    ruleOfferPrefill(
      saved,
      { categoryId: 'original', tagNames: ['Original'] },
      manual,
    ),
  ).not.toBeNull()
})

test('tag order and Unicode normalization do not count as manual categorisation', () => {
  const tags = [tag, { ...tag, id: 'tag-2', name: 'Café' }]
  expect(
    ruleOfferPrefill(
      { ...saved, lines: [{ categoryId: null, tags }] },
      { categoryId: '', tagNames: ['CAFE\u0301', 'travel'] },
      { category: false, tags: true },
    ),
  ).toBeNull()
})

test('no usable condition or no action means no offer', () => {
  expect(
    ruleOfferPrefill({ ...saved, payeeId: null, note: ' ' }, baseline, manual),
  ).toBeNull()
  expect(
    ruleOfferPrefill(
      { ...saved, lines: [{ categoryId: null, tags: [] }] },
      { categoryId: 'removed', tagNames: ['removed'] },
      { category: true, tags: true },
    ),
  ).toBeNull()
})

test('multiple split categories cannot be represented by one rule action', () => {
  expect(
    ruleOfferPrefill(
      { ...saved, lines: [...saved.lines, { categoryId: 'other', tags: [] }] },
      baseline,
      manual,
    ),
  ).toBeNull()
})
