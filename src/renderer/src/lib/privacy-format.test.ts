import { expect, test } from 'vitest'
import { createPrivacyFormatters } from './privacy-format'

test('private money never contains digits, including negative, zero and large amounts in every language and currency', () => {
  for (const language of ['hu', 'en', 'de'] as const) {
    const visible = createPrivacyFormatters(language, false)
    const hidden = createPrivacyFormatters(language, true)
    for (const currency of ['HUF', 'CHF'] as const) {
      for (const amount of [-12345, 0, 9007199254740991]) {
        expect(visible.money(amount, currency)).toMatch(/\d/)
        expect(hidden.money(amount, currency)).toBe('•••')
      }
    }
    expect(hidden.date(new Date('2026-01-15'))).toBe(
      visible.date(new Date('2026-01-15')),
    )
    expect(hidden.number(12)).toBe(visible.number(12))
    expect(hidden.privateText('1 CHF = 425.12 HUF')).toBe('•••')
    expect(visible.privateText('1 CHF = 425.12 HUF')).toBe('1 CHF = 425.12 HUF')
  }
})
