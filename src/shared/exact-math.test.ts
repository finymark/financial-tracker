import { describe, expect, test } from 'vitest'
import {
  addRational,
  gcd,
  rational,
  roundHalfAwayFromZero,
  safeInteger,
} from './exact-math'

describe('exact math', () => {
  test('normalizes rational values and adds them exactly', () => {
    expect(gcd(-18n, 24n)).toBe(6n)
    expect(rational(2n, -4n)).toEqual({ numerator: -1n, denominator: 2n })
    expect(addRational(rational(1n, 3n), rational(1n, 6n))).toEqual({
      numerator: 1n,
      denominator: 2n,
    })
  })

  test.each([
    [1n, 2n, 1],
    [-1n, 2n, -1],
    [1n, 3n, 0],
    [-1n, 3n, 0],
    [5n, 2n, 3],
    [-5n, 2n, -3],
  ] as const)(
    'rounds %s/%s half away from zero to %s',
    (numerator, denominator, expected) => {
      expect(roundHalfAwayFromZero(numerator, denominator)).toBe(expected)
    },
  )

  test('rejects zero denominators and unsafe integer results', () => {
    expect(() => rational(1n, 0n)).toThrow('exactMath.error.denominator')
    expect(() => safeInteger(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(
      'exactMath.error.unsafeInteger',
    )
  })
})
