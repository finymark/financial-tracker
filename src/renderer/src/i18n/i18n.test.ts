import { expect, test } from 'vitest'
import { catalogs, createFormatters, languages, translate } from './index'

test('every message key has a non-empty translation in HU, EN and DE', () => {
  const allKeys = [
    ...new Set(Object.values(catalogs).flatMap(Object.keys)),
  ].sort()

  for (const language of languages) {
    const catalog = catalogs[language]
    expect(Object.keys(catalog).sort(), language).toEqual(allKeys)
    for (const message of Object.values(catalog)) {
      expect(message.trim().length, language).toBeGreaterThan(0)
    }
  }
})

test.each(languages)('translates messages in %s', (language) => {
  const names = { hu: 'Beállítások', en: 'Settings', de: 'Einstellungen' }
  expect(translate(language, 'navigation.settings')).toBe(names[language])
})

test('uses the agreed Hungarian finance terms and kind-specific payee labels', () => {
  expect(translate('hu', 'navigation.receipts')).toBe('Blokkok')
  expect(translate('hu', 'receipts.title')).toBe('Feldolgozandó blokkok')
  expect(translate('hu', 'transactions.payee')).toBe('Bolt / partner')
  expect(translate('hu', 'transactions.payee.expense')).toBe('Bolt')
  expect(translate('hu', 'transactions.payee.income')).toBe('Forrás')
  expect(translate('hu', 'adjustments.rowType')).toBe('Egyenleg-egyeztetés')
  expect(translate('hu', 'transactions.excluded')).toBe('Kihagyva')
})

test.each([
  ['hu', 'hu-HU'],
  ['en', 'en-GB'],
  ['de', 'de-DE'],
] as const)('formats dates and numbers for %s', (language, locale) => {
  const format = createFormatters(language)
  const date = new Date('2026-01-15T12:00:00Z')
  const dateOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  } as const
  const numberOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 }

  expect(format.date(date, dateOptions)).toBe(
    new Intl.DateTimeFormat(locale, dateOptions).format(date),
  )
  expect(format.date(date)).toBe(
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date),
  )
  expect(format.number(12345.67, numberOptions)).toBe(
    new Intl.NumberFormat(locale, numberOptions).format(12345.67),
  )
  expect(format.number(12345.67)).toBe(
    new Intl.NumberFormat(locale).format(12345.67),
  )
})

test.each([
  ['hu', '12\u00a0346\u00a0Ft', '123,45\u00a0CHF'],
  ['en', 'HUF\u00a012,346', 'CHF\u00a0123.45'],
  ['de', '12.346\u00a0HUF', '123,45\u00a0CHF'],
] as const)(
  'displays HUF without decimals and CHF with hundredths in %s',
  (language, huf, chf) => {
    const format = createFormatters(language)
    expect(format.money(1234567, 'HUF')).toBe(huf)
    expect(format.money(12345, 'CHF')).toBe(chf)
  },
)

test('formats exact large and negative CHF hundredths without losing cents', () => {
  const format = createFormatters('en')
  expect(format.money(9007199254740991, 'CHF')).toBe(
    'CHF\u00a090,071,992,547,409.91',
  )
  expect(format.money(-1, 'CHF')).toBe('-CHF\u00a00.01')
  expect(format.money(0, 'CHF')).toBe('CHF\u00a00.00')
})

test('does not render rounded HUF values as negative zero', () => {
  const format = createFormatters('en')
  expect(format.money(-1, 'HUF')).toBe('HUF\u00a00')
})
