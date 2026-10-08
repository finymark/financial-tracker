export function amountInput(minor: number): string {
  const value = BigInt(minor)
  const fraction = String(value % 100n).padStart(2, '0')
  return fraction === '00'
    ? String(value / 100n)
    : `${value / 100n}.${fraction}`
}
