import { expect, test } from 'vitest'
import { reportFlagsForCategory } from './transaction-report-filter'

test('choosing a category drops uncategorized while retaining the report kind', () => {
  expect(
    reportFlagsForCategory({ kind: 'expense', uncategorized: true }, 'food'),
  ).toEqual({
    kind: 'expense',
    uncategorized: undefined,
    exactCategory: undefined,
  })
})

test('exact category survives only while the applied category is unchanged', () => {
  const request = {
    kind: 'expense' as const,
    categoryId: 'food',
    exactCategory: true,
  }
  expect(reportFlagsForCategory(request, 'food').exactCategory).toBe(true)
  expect(reportFlagsForCategory(request, 'rent').exactCategory).toBeUndefined()
  expect(reportFlagsForCategory(request, '').exactCategory).toBeUndefined()
})

test('ordinary filters do not acquire report flags after they have been cleared', () => {
  expect(
    reportFlagsForCategory(
      { categoryId: 'food', exclusion: 'hideExcluded', period: 'thisMonth' },
      'food',
    ),
  ).toEqual({
    kind: undefined,
    uncategorized: undefined,
    exactCategory: undefined,
  })
  expect(
    reportFlagsForCategory({ uncategorized: true }, '').uncategorized,
  ).toBe(true)
})
