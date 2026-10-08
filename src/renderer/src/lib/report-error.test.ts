import { expect, test } from 'vitest'
import { reportError } from './report-error'

test('maps range validation errors, including IPC-wrapped messages, to range guidance', () => {
  expect(reportError(new Error('reports.error.range'))).toBe(
    'reports.error.range',
  )
  expect(
    reportError(
      new Error(
        "Error invoking remote method 'reports:category-breakdown': Error: reports.error.range",
      ),
    ),
  ).toBe('reports.error.range')
})

test('keeps spending pace and other failures generic', () => {
  expect(reportError(new Error('exchangeRates.error.total'))).toBe(
    'reports.error',
  )
  expect(reportError(new Error('Profile is closed'))).toBe('reports.error')
  expect(reportError(undefined)).toBe('reports.error')
})
