export function amountInput(minor: number): string {
  const signed = BigInt(minor)
  const value = signed < 0n ? -signed : signed
  const fraction = String(value % 100n).padStart(2, '0')
  const amount =
    fraction === '00' ? String(value / 100n) : `${value / 100n}.${fraction}`
  return signed < 0n ? `-${amount}` : amount
}
