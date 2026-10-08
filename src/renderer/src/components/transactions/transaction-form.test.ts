import { expect, test } from 'vitest'
import {
  addPendingTag,
  createTransactionInput,
  emptyForm,
  splitLine,
} from './transaction-form'

test('adds the pending tag once using the shared normalized tag identity', () => {
  const form = {
    ...emptyForm('account-id'),
    tagNames: ['Élelmiszer'],
    pendingTagName: '  élelmiszer  ',
  }

  expect(addPendingTag(form)).toMatchObject({
    tagNames: ['Élelmiszer'],
    pendingTagName: '',
  })
})

test('builds unsplit and split transaction inputs through the shared form helper', () => {
  expect(
    createTransactionInput(
      {
        ...emptyForm('account-id'),
        kind: 'income',
        amount: '1.234,50',
        payeeName: 'Payee',
        categoryId: 'category-id',
        pendingTagName: ' New tag ',
        note: 'Note',
        excluded: true,
      },
      'CHF',
    ),
  ).toEqual({
    accountId: 'account-id',
    kind: 'income',
    date: expect.any(String),
    totalMinor: 123_450,
    payeeName: 'Payee',
    categoryId: 'category-id',
    note: 'Note',
    tagNames: ['New tag'],
    excluded: true,
  })

  expect(
    createTransactionInput(
      {
        ...emptyForm('account-id'),
        amount: '3',
        categoryId: 'ignored-category',
        tagNames: ['ignored-tag'],
        note: 'ignored note',
        splitLines: [
          splitLine({ amount: '1', pendingTagName: 'First' }),
          splitLine({ amount: '2', tagNames: ['Second'] }),
        ],
      },
      'HUF',
    ),
  ).toMatchObject({
    categoryId: null,
    note: '',
    tagNames: [],
    lines: [
      { amountMinor: 100, tagNames: ['First'] },
      { amountMinor: 200, tagNames: ['Second'] },
    ],
  })
})
