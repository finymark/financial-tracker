import { expect, test } from 'vitest'
import type { Transaction } from '../../../shared/transactions'
import type { TransactionTemplate } from '../../../shared/templates'
import {
  recurringPrefillFromTemplate,
  recurringPrefillFromTransaction,
} from './recurring-prefill'

test('maps an unsplit transaction and starts its monthly schedule at the next clamped occurrence', () => {
  const transaction = {
    id: 'transaction',
    kind: 'expense',
    accountId: 'account',
    date: '2024-01-31',
    totalMinor: 12_345,
    payeeName: 'Payee',
    note: 'Note',
    lines: [
      {
        categoryId: 'category',
        tags: [{ id: 'tag', name: 'Trip', createdAt: 'timestamp' }],
      },
    ],
    line: {
      categoryId: 'category',
      tags: [{ id: 'tag', name: 'Trip', createdAt: 'timestamp' }],
    },
  } as Transaction

  expect(recurringPrefillFromTransaction(transaction)).toEqual({
    kind: 'expense',
    accountId: 'account',
    amountMinor: 12_345,
    payeeName: 'Payee',
    categoryId: 'category',
    tagIds: ['tag'],
    note: 'Note',
    schedule: { type: 'monthly', day: 31, intervalMonths: 1 },
    startDate: '2024-02-29',
    endDate: null,
  })
  expect(
    recurringPrefillFromTransaction({
      ...transaction,
      lines: [transaction.line, transaction.line],
    }),
  ).toBeNull()
})

test('maps a template through category kind and existing tag ids using the supplied source date', () => {
  const template = {
    kind: null,
    accountId: 'account',
    totalMinor: 500,
    payeeName: 'Payee',
    categoryId: 'income-category',
    tagNames: ['TRIP', 'missing'],
    note: null,
  } as TransactionTemplate

  expect(
    recurringPrefillFromTemplate(
      template,
      '2026-04-30',
      [{ id: 'tag', name: 'Trip', createdAt: 'timestamp' }],
      [{ id: 'income-category', kind: 'income' }],
    ),
  ).toEqual({
    kind: 'income',
    accountId: 'account',
    amountMinor: 500,
    payeeName: 'Payee',
    categoryId: 'income-category',
    tagIds: ['tag'],
    note: '',
    schedule: { type: 'monthly', day: 30, intervalMonths: 1 },
    startDate: '2026-05-30',
    endDate: null,
  })
})
