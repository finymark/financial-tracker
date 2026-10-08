import type { Currency } from './accounts'

export const MAX_AMOUNT_EXPRESSION_LENGTH = 200

// Storage precision, not display precision (ADR 0002).
const precision: Record<Currency, number> = { HUF: 2, CHF: 2 }

interface Rational {
  numerator: bigint
  denominator: bigint
}

export function parseAmountExpression(
  value: string,
  currency: Currency,
  errorKey: string,
  options: { allowNegative?: boolean; allowZero?: boolean } = {},
): number {
  const decimals = precision[currency]
  if (decimals === undefined || value.length > MAX_AMOUNT_EXPRESSION_LENGTH)
    throw new Error(errorKey)
  const input = value.trim().replace(/[\u00a0\u202f]/g, ' ')
  let position = 0

  function rational(numerator: bigint, denominator = 1n): Rational {
    if (denominator === 0n) throw new Error(errorKey)
    return denominator < 0n
      ? { numerator: -numerator, denominator: -denominator }
      : { numerator, denominator }
  }

  function skipWhitespace() {
    while (/\s/.test(input[position] ?? '') && position < input.length)
      position += 1
  }

  function number(): Rational {
    skipWhitespace()
    const match = /^[0-9][0-9., ]*/.exec(input.slice(position))
    if (!match) throw new Error(errorKey)
    position += match[0].length
    const literal = match[0].trim()
    let integer = literal
    let fraction = ''
    const dot = literal.lastIndexOf('.')
    const comma = literal.lastIndexOf(',')
    const separator = Math.max(dot, comma)
    if (separator >= 0) {
      const tail = literal.slice(separator + 1)
      // A valid three-digit grouping wins over a decimal beyond the currency's
      // storage precision. In this ambiguity, zero starts a decimal: 0.005.
      const grouped = /^[1-9][0-9]{0,2}([., ])[0-9]{3}(?:\1[0-9]{3})*$/.test(
        literal,
      )
      if ((dot >= 0 && comma >= 0) || tail.length <= decimals || !grouped) {
        if (!/^[0-9]+$/.test(tail)) throw new Error(errorKey)
        integer = literal.slice(0, separator)
        if (integer.includes(literal[separator])) throw new Error(errorKey)
        fraction = tail
      }
    }
    if (
      !/^\d+$/.test(integer) &&
      !/^\d{1,3}([., ])\d{3}(?:\1\d{3})*$/.test(integer)
    ) {
      throw new Error(errorKey)
    }
    return rational(
      BigInt(integer.replace(/[., ]/g, '') + fraction),
      10n ** BigInt(fraction.length),
    )
  }

  function operand(): Rational {
    skipWhitespace()
    if (input[position] === '+' || input[position] === '-') {
      const sign = input[position++]
      const result = operand()
      return sign === '-'
        ? rational(-result.numerator, result.denominator)
        : result
    }
    if (input[position] === '(') {
      position += 1
      const result = expression()
      skipWhitespace()
      if (input[position++] !== ')') throw new Error(errorKey)
      return result
    }
    return number()
  }

  function product(): Rational {
    let result = operand()
    skipWhitespace()
    while (input[position] === '*' || input[position] === '/') {
      const operator = input[position++]
      const right = operand()
      result =
        operator === '*'
          ? rational(
              result.numerator * right.numerator,
              result.denominator * right.denominator,
            )
          : rational(
              result.numerator * right.denominator,
              result.denominator * right.numerator,
            )
      skipWhitespace()
    }
    return result
  }

  function expression(): Rational {
    let result = product()
    skipWhitespace()
    while (input[position] === '+' || input[position] === '-') {
      const operator = input[position++]
      const right = product()
      result = rational(
        result.numerator * right.denominator +
          (operator === '+' ? 1n : -1n) * right.numerator * result.denominator,
        result.denominator * right.denominator,
      )
      skipWhitespace()
    }
    return result
  }

  const result = expression()
  if (position !== input.length) throw new Error(errorKey)
  // Keep every intermediate result exact. Round the FINAL result once to the
  // nearest hundredth, ties away from zero (1/3 -> 0.33, 0.005 -> 0.01).
  const negative = result.numerator < 0n
  const scaled = (negative ? -result.numerator : result.numerator) * 100n
  let rounded = scaled / result.denominator
  if ((scaled % result.denominator) * 2n >= result.denominator) rounded += 1n
  const amount = Number(negative ? -rounded : rounded)
  if (
    !Number.isSafeInteger(amount) ||
    (!options.allowZero && amount === 0) ||
    (!options.allowNegative && amount < 0)
  ) {
    throw new Error(errorKey)
  }
  return amount
}
