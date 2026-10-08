import { expect, test } from 'vitest'
import { amountInput } from './amount-input-value'

test.each([
  [0, '0'],
  [12345, '123.45'],
  [-12345, '-123.45'],
  [-1, '-0.01'],
  [-100, '-1'],
  [Number.MAX_SAFE_INTEGER, '90071992547409.91'],
])(
  'formats %s hundredths for template, transaction and adjustment drafts',
  (minor, expected) => {
    expect(amountInput(minor)).toBe(expected)
  },
)
