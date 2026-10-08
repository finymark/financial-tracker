export interface Rational {
  numerator: bigint
  denominator: bigint
}

export function gcd(left: bigint, right: bigint): bigint {
  left = left < 0n ? -left : left
  right = right < 0n ? -right : right
  while (right !== 0n) [left, right] = [right, left % right]
  return left || 1n
}

export function rational(
  numerator: bigint,
  denominator = 1n,
  error = 'exactMath.error.denominator',
): Rational {
  if (denominator === 0n) throw new Error(error)
  if (denominator < 0n) {
    numerator = -numerator
    denominator = -denominator
  }
  const divisor = gcd(numerator, denominator)
  return { numerator: numerator / divisor, denominator: denominator / divisor }
}

export function addRational(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  )
}

export function safeInteger(
  value: bigint,
  error = 'exactMath.error.unsafeInteger',
): number {
  const result = Number(value)
  if (!Number.isSafeInteger(result)) throw new Error(error)
  return result
}

export function roundHalfAwayFromZero(
  numerator: bigint,
  denominator: bigint,
  error = 'exactMath.error.unsafeInteger',
): number {
  const normalized = rational(numerator, denominator, error)
  const negative = normalized.numerator < 0n
  const absolute = negative ? -normalized.numerator : normalized.numerator
  let result = absolute / normalized.denominator
  if ((absolute % normalized.denominator) * 2n >= normalized.denominator)
    result += 1n
  return safeInteger(negative ? -result : result, error)
}
