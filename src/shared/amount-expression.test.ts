import { expect, test } from 'vitest'
import { currencies } from './accounts'
import { parseAmountExpression } from './amount-expression'

test.each(currencies)('accepts comma decimals in %s hundredths', (currency) => {
  expect(parseAmountExpression('1,5', currency, 'invalid')).toBe(150)
})

test.each(currencies)(
  'resolves decimal and thousands separators using two-place storage precision in %s',
  (currency) => {
    for (const [input, expected] of [
      ['1.234', 123400],
      ['1,234', 123400],
      ['1 234,50', 123450],
      ['1.234,5', 123450],
      ['1,234.5', 123450],
      ['1.23', 123],
      ['1.234.567,89', 123456789],
      ['1,234,567.89', 123456789],
      ['1\u00a0234,50', 123450],
      ['1\u202f234.50', 123450],
    ] as const) {
      expect(parseAmountExpression(input, currency, 'invalid'), input).toBe(
        expected,
      )
    }
  },
)

test.each(currencies)(
  'calculates amounts with operator precedence in %s',
  (currency) => {
    for (const [input, expected] of [
      ['12000/2', 600000],
      ['4490*3', 1347000],
      ['100+250-30', 32000],
      ['100+250*3', 85000],
      ['12/2*3', 1800],
      ['12-2-3', 700],
      ['1,5 * 2 + 0.25', 325],
    ] as const) {
      expect(parseAmountExpression(input, currency, 'invalid'), input).toBe(
        expected,
      )
    }
  },
)

test.each(currencies)(
  'rounds the final result once, with ties away from zero in %s',
  (currency) => {
    for (const [input, expected] of [
      ['1/3', 33],
      ['2/3', 67],
      ['0.005', 1],
      ['0,005', 1],
      ['1/200', 1],
      ['1/3*3', 100],
      ['1/200*2', 1],
      ['0.10+0.20', 30],
      ['0-1/200', -1],
      ['0-2/3', -67],
    ] as const) {
      expect(
        parseAmountExpression(input, currency, 'invalid', {
          allowNegative: true,
        }),
        input,
      ).toBe(expected)
    }
  },
)

test('supports parentheses and signed operands while checking the final sign', () => {
  for (const [input, expected] of [
    ['(100+250)*3', 105000],
    ['2*(3+(4/2))', 1000],
    ['-5+10', 500],
    ['5*-2+15', 500],
    ['5--2', 700],
    ['+1,5', 150],
    ['1/(-2)*-3', 150],
  ] as const) {
    expect(parseAmountExpression(input, 'HUF', 'invalid'), input).toBe(expected)
  }
  expect(
    parseAmountExpression('-1.5', 'CHF', 'invalid', { allowNegative: true }),
  ).toBe(-150)
})

test.each(currencies)(
  'rejects invalid or oversized expressions in %s',
  (currency) => {
    for (const input of [
      '',
      ' ',
      '1+',
      '*2',
      '1**2',
      '1//2',
      '1(2)',
      '(1+2',
      '1+2)',
      '()',
      '1.2.3',
      '1,23,456',
      '12 34',
      '1 23,50',
      '1.234,5.6',
      '1,234.5,6',
      '1.',
      '1,',
      '1e3',
      'NaN',
      'Infinity',
      'Math.max(1,2)',
      'process.exit()',
      '1;2',
      '2^3',
      '1+'.repeat(100) + '1',
    ]) {
      expect(
        () => parseAmountExpression(input, currency, 'invalid'),
        input,
      ).toThrow('invalid')
    }
  },
)

test.each(currencies)(
  'rejects division by zero and non-positive transaction results in %s',
  (currency) => {
    for (const input of [
      '1/0',
      '0/0',
      '5/(2-2)',
      '-1',
      '100-250',
      '0',
      '1-1',
      '1/1000',
    ]) {
      expect(
        () => parseAmountExpression(input, currency, 'invalid'),
        input,
      ).toThrow('invalid')
    }
  },
)

test('permits zero and negative opening balances only when requested', () => {
  expect(
    parseAmountExpression('1-1', 'HUF', 'invalid', { allowZero: true }),
  ).toBe(0)
  expect(
    parseAmountExpression('1-3', 'HUF', 'invalid', {
      allowNegative: true,
      allowZero: true,
    }),
  ).toBe(-200)
  expect(() =>
    parseAmountExpression('-1', 'HUF', 'invalid', { allowZero: true }),
  ).toThrow('invalid')
})

test.each(currencies)(
  'preserves safe integer hundredths and rejects final overflow in %s',
  (currency) => {
    expect(
      parseAmountExpression('90071992547409.91', currency, 'invalid'),
    ).toBe(9007199254740991)
    expect(
      parseAmountExpression('90071992547409.90+0.01', currency, 'invalid'),
    ).toBe(9007199254740991)
    expect(
      parseAmountExpression('9007199254740991/100', currency, 'invalid'),
    ).toBe(9007199254740991)
    for (const input of [
      '90071992547409.92',
      '90071992547409.91+0.01',
      '90071992547409.91*2',
    ]) {
      expect(
        () => parseAmountExpression(input, currency, 'invalid'),
        input,
      ).toThrow('invalid')
    }
    expect(
      parseAmountExpression('-90071992547409.91', currency, 'invalid', {
        allowNegative: true,
      }),
    ).toBe(-9007199254740991)
    expect(() =>
      parseAmountExpression('-90071992547409.92', currency, 'invalid', {
        allowNegative: true,
      }),
    ).toThrow('invalid')
  },
)
