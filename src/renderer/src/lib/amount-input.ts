export function parseAmountInput(
  value: string,
  errorKey: string,
  options: { allowNegative?: boolean; allowZero?: boolean } = {},
): number {
  const sign = options.allowNegative ? '-?' : ''
  const match = new RegExp(`^(${sign})(\\d+)(?:[.,](\\d{1,2}))?$`).exec(
    value.trim(),
  )
  if (!match) throw new Error(errorKey)
  const absolute =
    BigInt(match[2]) * 100n + BigInt((match[3] ?? '').padEnd(2, '0'))
  const amount = Number(match[1] === '-' ? -absolute : absolute)
  if (!Number.isSafeInteger(amount) || (!options.allowZero && amount === 0)) {
    throw new Error(errorKey)
  }
  return amount
}
